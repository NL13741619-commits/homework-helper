-- Run only in the authorized second-base database. Synthetic mock fixtures only.
-- Caller may wrap in BEGIN/ROLLBACK for a nonpersistent rehearsal.
do $$
declare
 c jsonb; r jsonb; accepted jsonb; lease1 jsonb; lease2 jsonb; tid uuid;
 prefix text := 'bridge_test_'||replace(gen_random_uuid()::text,'-','');
 h bigint; laws bigint; constitution bigint;
begin
 select count(*) into h from public.homeworks;
 select count(*) into laws from public.law_documents;
 select count(*) into constitution from public.roc_tw_constitution;
 c:=jsonb_build_object('command_id',prefix,'nonce',prefix||'_nonce','sender','base1','recipient','base2',
  'issued_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '5 minutes','task_type','dry_run',
  'payload',jsonb_build_object('repository','NL13741619-commits/homework-helper','project_ref','svtkpdmqemidlasowqew',
   'branch','feature/aivault-rebuild','mode','mock','model','none','tests',jsonb_build_array('bridge_contract_v1')));
 accepted:=public.aivault_bridge('intake','base1',c);
 assert accepted->>'ok'='true','valid command rejected'; tid:=(accepted->>'task_id')::uuid;
 r:=public.aivault_bridge('intake','base1',c);
 assert r->>'error'='DUPLICATE_OR_REPLAY','duplicate not denied';
 r:=public.aivault_bridge('intake','base1',c||jsonb_build_object('command_id',prefix||'_replay'));
 assert r->>'error'='DUPLICATE_OR_REPLAY','nonce replay not denied';
 r:=public.aivault_bridge('intake','base1',c||jsonb_build_object('expires_at',clock_timestamp()-interval '1 second'));
 assert r->>'error'='EXPIRED_COMMAND','expired not denied';
 r:=public.aivault_bridge('intake','base1',c||'{"payload":null}'::jsonb);
 assert r->>'error'='MALFORMED_PAYLOAD','malformed not denied';
 r:=public.aivault_bridge('intake','intruder',c);
 assert r->>'error'='UNAUTHORIZED_SENDER','sender not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,repository}','"NL13741619-commits/safe-reunion"'));
 assert r->>'error'='PROTECTED_TARGET','protected repo not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,repository}','"NL13741619-commits/safe-reunion-login"'));
 assert r->>'error'='PROTECTED_TARGET','protected login repo not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,project_ref}','"perfsipperncvjocznhl"'));
 assert r->>'error'='PROTECTED_TARGET','protected backend not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,branch}','"main"'));
 assert r->>'error'='DIRECT_MAIN_OR_BRANCH_DENIED','direct main not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,model}','"paid-model"'));
 assert r->>'error'='MODEL_REQUEST_DENIED','paid model not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,tests}','["sh -c evil"]'));
 assert r->>'error'='PAYLOAD_POLICY_DENIED','arbitrary test not denied';
 r:=public.aivault_bridge('intake','base1',jsonb_set(c,'{payload,shell}','"echo evil"'));
 assert r->>'error'='MALFORMED_PAYLOAD','shell field not denied';
 lease1:=public.aivault_bridge('claim','runner-dry-run',jsonb_build_object('task_id',tid));
 assert lease1->>'ok'='true','claim failed';
 r:=public.aivault_bridge('claim','runner-dry-run',jsonb_build_object('task_id',tid));
 assert r->>'error'='LEASE_CONFLICT','lease conflict not denied';
 r:=public.aivault_bridge('finish','runner-dry-run',jsonb_build_object('task_id',tid,'fencing_token','0'));
 assert r->>'error'='STALE_FENCING_OR_LEASE','bad fence not denied';
 -- Advance fixture lease expiry without sleeps; never mutate a nonfixture task.
 update public.ai_agent_leases set expires_at=clock_timestamp()-interval '1 second' where task_id=tid;
 r:=public.aivault_bridge('finish','runner-dry-run',jsonb_build_object('task_id',tid,'fencing_token',lease1->>'fencing_token'));
 assert r->>'error'='STALE_FENCING_OR_LEASE','expired lease not denied';
 lease2:=public.aivault_bridge('claim','runner-dry-run',jsonb_build_object('task_id',tid));
 assert lease2->>'ok'='true','reclaim failed';
 assert (lease2->>'fencing_token')::bigint>(lease1->>'fencing_token')::bigint,'fence not monotonic';
 r:=public.aivault_bridge('finish','runner-dry-run',jsonb_build_object('task_id',tid,'fencing_token',lease1->>'fencing_token'));
 assert r->>'error'='STALE_FENCING_OR_LEASE','stale owner not denied';
 r:=public.aivault_bridge('finish','runner-dry-run',jsonb_build_object('task_id',tid,'fencing_token',lease2->>'fencing_token'));
 assert r->>'model_status'='BLOCKED_NO_MODEL','mock misreported inference';
 r:=public.aivault_bridge('finish','runner-dry-run',jsonb_build_object('task_id',tid,'fencing_token',lease2->>'fencing_token'));
 assert r->>'error'='STALE_FENCING_OR_LEASE','completion replay not denied';
 accepted:=public.aivault_bridge('intake','base1',c||jsonb_build_object('command_id',prefix||'_expiry','nonce',prefix||'_expiry_nonce'));
 tid:=(accepted->>'task_id')::uuid;
 update public.ai_agent_tasks set expires_at=clock_timestamp()-interval '1 second' where id=tid;
 r:=public.aivault_bridge('claim','runner-dry-run',jsonb_build_object('task_id',tid));
 assert r->>'error'='TASK_EXPIRED','task expiry not enforced';
 assert (select count(*) from public.ai_agent_tasks where command_id=prefix)=1,'duplicate task created';
 assert (select count(*) from public.homeworks)=h,'legacy homework count changed';
 assert (select count(*) from public.law_documents)=laws,'legacy law count changed';
 assert (select count(*) from public.roc_tw_constitution)=constitution,'legacy constitution count changed';
 assert not has_function_privilege('anon','public.aivault_bridge(text,text,jsonb)','execute'),'anon RPC privilege';
 assert not has_function_privilege('authenticated','public.aivault_bridge(text,text,jsonb)','execute'),'authenticated RPC privilege';
 insert into public.ai_agent_events(event_type,detail) values('bridge.test_suite_passed',jsonb_build_object(
  'suite','bridge_contract_v1','fixture_prefix',prefix,'dry_run',true,'legacy_counts',jsonb_build_array(h,laws,constitution),
  'checks',jsonb_build_array('duplicate','expired_command','malformed','unauthorized_sender','lease_conflict','stale_fencing','replay','protected_repository','direct_main','paid_model','task_expiry','expired_lease','reclaim','arbitrary_test','shell_payload','completion_replay','rpc_acl')));
end $$;
select id,event_type,detail from public.ai_agent_events where event_type='bridge.test_suite_passed' order by id desc limit 1;
