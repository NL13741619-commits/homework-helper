-- All test entries, memberships, queue tasks and evidence are rolled back.
begin;
insert into public.ai_agent_memory_members(instance_id,principal_id,member_kind,can_read,can_write)
 values('base-002:dawn-light','fixture-memory-worker','worker',true,true),
 ('base-002:dawn-light','fixture-memory-reader','reader',true,false);
insert into public.ai_agent_channel_members(channel_id,principal_id,member_kind,actions)
 values('ch-0999','fixture-memory-worker','worker',array['claim','finish','artifact_write','status']);
set local role service_role;
do $$
declare r jsonb; b jsonb; q jsonb; lease jsonb; task text; entry text;
 used integer; remaining integer; count_tests integer:=0; prefix text:='memory_'||replace(gen_random_uuid()::text,'-','');
begin
 assert not has_table_privilege('anon','public.ai_agent_memory_entries','select');
 assert not has_table_privilege('authenticated','public.ai_agent_memory_entries','insert');
 assert not has_function_privilege('anon','public.aivault_memory(text,text,text,jsonb)','execute');
 assert not has_function_privilege('authenticated','public.aivault_memory(text,text,text,jsonb)','execute');
 count_tests:=count_tests+1;
 r:=public.aivault_memory('status','unknown','base-002:dawn-light','{}');assert r->>'error'='MEMORY_ACCESS_DENIED';
 r:=public.aivault_memory('status','base2-controller','base-001:dawn-light','{}');assert r->>'error'='MEMORY_ACCESS_DENIED';
 count_tests:=count_tests+1;
 b:=jsonb_build_object('title','Unicode fixture','content','曙光🌅','source_ref','isolated-test-only','idempotency_key',prefix||'_unicode');
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b);assert r->>'ok'='true';
 entry:=r->>'entry_id';assert r->>'content_chars'='3';count_tests:=count_tests+1;
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b);assert r->>'duplicate'='true';
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b||'{"content":"changed"}');assert r->>'error'='MEMORY_IDEMPOTENCY_CONFLICT';
 count_tests:=count_tests+1;
 r:=public.aivault_memory('append','fixture-memory-reader','base-002:dawn-light',b);assert r->>'error'='MEMORY_ACTION_DENIED';
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b||'{"instance_id":"base-001:dawn-light"}');assert r->>'error'='MALFORMED_MEMORY_REQUEST';
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b||jsonb_build_object('content',repeat('x',10001)));assert r->>'error'='MALFORMED_MEMORY_REQUEST';
 count_tests:=count_tests+1;
 r:=public.aivault_memory('read','fixture-memory-reader','base-002:dawn-light',jsonb_build_object('entry_id',entry,'offset',2,'limit',1));assert r->>'content'='🌅';
 r:=public.aivault_memory('read','base2-controller','base-002:dawn-light',jsonb_build_object('entry_id',entry,'offset',0,'limit',4001));assert r->>'error'='MALFORMED_MEMORY_REQUEST';
 r:=public.aivault_memory('recall','base2-controller','base-002:dawn-light','{"query":"曙光","limit":1}');assert jsonb_array_length(r->'entries')=1;
 count_tests:=count_tests+1;
 r:=public.aivault_memory('append','fixture-memory-worker','base-002:dawn-light',b);assert r->>'error'='MEMORY_LEASE_DENIED';
 q:=jsonb_build_object('command_id',prefix,'nonce',prefix||'_nonce','sender','base1','recipient','base2','issued_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '5 minutes','task_type','dry_run',
 'payload',jsonb_build_object('repository','NL13741619-commits/homework-helper','project_ref','svtkpdmqemidlasowqew','branch','feature/aivault-rebuild','mode','mock','model','none','tests',jsonb_build_array('bridge_contract_v1')));
 r:=public.aivault_channel('intake','base1','ch-0999',q);assert r->>'ok'='true';task:=r->>'task_id';
 r:=public.aivault_collaboration('dispatch','base2-controller','ch-0999',jsonb_build_object('task_id',task,'assignee','fixture-memory-worker'));assert r->>'ok'='true';
 lease:=public.aivault_channel('claim','fixture-memory-worker','ch-0999',jsonb_build_object('task_id',task));assert lease->>'ok'='true';
 b:=b||jsonb_build_object('task_id',task,'fencing_token',lease->>'fencing_token','idempotency_key',prefix||'_worker');
 r:=public.aivault_memory('append','fixture-memory-worker','base-002:dawn-light',b);assert r->>'ok'='true';
 r:=public.aivault_memory('append','fixture-memory-worker','base-002:dawn-light',b||jsonb_build_object('fencing_token','0','idempotency_key',prefix||'_stale'));assert r->>'error'='MEMORY_LEASE_DENIED';
 r:=public.aivault_channel('finish','fixture-memory-worker','ch-0999',jsonb_build_object('task_id',task,'fencing_token',lease->>'fencing_token'));assert r->>'ok'='true';
 r:=public.aivault_memory('append','fixture-memory-worker','base-002:dawn-light',b);assert r->>'error'='MEMORY_LEASE_DENIED';
 count_tests:=count_tests+1;
 begin update public.ai_agent_memory_entries set content='tamper' where id=entry::bigint;raise exception 'update unexpectedly permitted';exception when insufficient_privilege then null;end;
 begin delete from public.ai_agent_memory_entries where id=entry::bigint;raise exception 'delete unexpectedly permitted';exception when insufficient_privilege then null;end;
 count_tests:=count_tests+1;
 select coalesce(sum(content_chars),0)::integer into used from public.ai_agent_memory_entries where instance_id='base-002:dawn-light';
 while used<500000 loop
  remaining:=least(10000,500000-used);
  r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',jsonb_build_object('title','capacity fixture','content',repeat('字',remaining),'source_ref','isolated-test-only','idempotency_key',prefix||'_fill_'||used));
  assert r->>'ok'='true';used:=used+remaining;
 end loop;
 r:=public.aivault_memory('status','base2-controller','base-002:dawn-light','{}');assert r->>'used_chars'='500000' and r->>'remaining_chars'='0';
 b:=jsonb_build_object('title','overflow','content','字','source_ref','isolated-test-only','idempotency_key',prefix||'_overflow');
 r:=public.aivault_memory('append','base2-controller','base-002:dawn-light',b);assert r->>'error'='MEMORY_CAPACITY_OR_CONSTRAINT';
 begin
  insert into public.ai_agent_memory_entries(instance_id,principal_id,idempotency_key,title,content,source_ref)
   values('base-002:dawn-light','base2-controller',prefix||'_direct','overflow','x','isolated-test-only');
  raise exception 'direct capacity bypass unexpectedly permitted';
 exception when check_violation then null;end;
 count_tests:=count_tests+1;
 insert into public.ai_agent_events(event_type,detail) values('dawn.memory_suite_passed',jsonb_build_object('checks',count_tests,'exact_capacity_chars',500000,'unicode',true,'fenced_worker_write',true,'real_inference',false,'fixtures_rolled_back',true));
end $$;
reset role;
-- Disabled/revoked identity and kill switch are admin changes within rollback.
update public.ai_agent_memory_members set enabled=false where principal_id='fixture-memory-reader';
set local role service_role;
do $$ declare r jsonb;begin r:=public.aivault_memory('status','fixture-memory-reader','base-002:dawn-light','{}');assert r->>'error'='MEMORY_ACCESS_DENIED';end $$;
reset role;
update public.ai_agent_memory_spaces set enabled=false where instance_id='base-002:dawn-light';
set local role service_role;
do $$ declare r jsonb;begin r:=public.aivault_memory('status','base2-controller','base-002:dawn-light','{}');assert r->>'error'='MEMORY_ACCESS_DENIED';end $$;
select event_type,detail from public.ai_agent_events where event_type='dawn.memory_suite_passed' order by id desc limit 1;
rollback;
