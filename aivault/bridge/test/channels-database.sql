-- Synthetic fixtures only; run inside a transaction for repeatable validation.
insert into public.ai_agent_channel_members(channel_id,principal_id,member_kind,actions)
values ('ch-0001','fixture-worker-a','worker',array['claim','finish','status','artifact_read','artifact_write']),
 ('ch-0001','fixture-worker-b','worker',array['claim','finish','status','artifact_read','artifact_write']),
 ('ch-0001','fixture-reviewer','reviewer',array['status','artifact_read'])
on conflict(channel_id,principal_id) do update set enabled=true,expires_at=null;
do $$
declare
 c jsonb;r jsonb;tid uuid;tid2 uuid;lease jsonb;artifact jsonb;readback jsonb;
 prefix text:='channel_test_'||replace(gen_random_uuid()::text,'-','');
begin
 assert (select count(*) from public.ai_agent_channels)=1000,'channel count';
 assert (select count(*) from generate_series(1,1000) n left join public.ai_agent_channels c on c.id='ch-'||lpad(n::text,4,'0') where c.id is null)=0,'missing channel';
 c:=jsonb_build_object('command_id',prefix,'nonce',prefix||'_nonce','sender','base1','recipient','base2',
  'issued_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '5 minutes','task_type','dry_run',
  'payload',jsonb_build_object('repository','NL13741619-commits/homework-helper','project_ref','svtkpdmqemidlasowqew',
  'branch','feature/aivault-rebuild','mode','mock','model','none','tests',jsonb_build_array('bridge_contract_v1')));
 r:=public.aivault_channel('intake','base1','ch-0001',c);assert r->>'ok'='true','channel intake';tid:=(r->>'task_id')::uuid;
 r:=public.aivault_channel('intake','base1','ch-0001',c);assert r->>'error'='DUPLICATE_OR_REPLAY','channel duplicate';
 r:=public.aivault_channel('intake','base1','ch-1000',c);assert r->>'error'='DUPLICATE_OR_REPLAY','cross-channel replay';
 r:=public.aivault_channel('intake','unknown-helper','ch-0001',c);assert r->>'error'='CHANNEL_ACCESS_DENIED','unknown member';
 r:=public.aivault_channel('status','base1','ch-1001',jsonb_build_object('task_id',tid));assert r->>'error'='CHANNEL_DISABLED_OR_UNKNOWN','out of range';
 r:=public.aivault_channel('status','base1','ch-1000',jsonb_build_object('task_id',tid));assert r->>'error'='TASK_NOT_IN_CHANNEL','cross channel task';
 r:=public.aivault_channel('claim','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid));assert r->>'error'='TASK_NOT_ASSIGNED','unassigned claim';
 r:=public.aivault_bridge('claim','runner-dry-run',jsonb_build_object('task_id',tid));assert r->>'error'='CHANNEL_SCOPE_REQUIRED','legacy bypass';
 r:=public.aivault_collaboration('dispatch','base1','ch-0001',jsonb_build_object('task_id',tid,'assignee','fixture-worker-a'));assert r->>'error'='CHANNEL_ACCESS_DENIED','noncontroller dispatch';
 r:=public.aivault_collaboration('dispatch','base2-controller','ch-0001',jsonb_build_object('task_id',tid,'assignee','fixture-worker-a'));assert r->>'ok'='true','controller dispatch';
 r:=public.aivault_channel('claim','fixture-worker-b','ch-0001',jsonb_build_object('task_id',tid));assert r->>'error'='TASK_NOT_ASSIGNED','other worker claim';
 r:=public.aivault_collaboration('artifact_write','base1','ch-0001',jsonb_build_object('task_id',tid,'path','config/support-ai.json','content','{"model_status":"BLOCKED_NO_MODEL","mode":"dry_run"}','fencing_token',null));assert r->>'ok'='true','base1 prework write';artifact:=r;
 r:=public.aivault_collaboration('artifact_read','base1','ch-0001',jsonb_build_object('task_id',tid,'artifact_id',artifact->>'artifact_id'));assert r->>'ok'='true','base1 read';
 lease:=public.aivault_channel('claim','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid));assert lease->>'ok'='true','assigned worker claim';
 r:=public.aivault_collaboration('artifact_write','fixture-reviewer','ch-0001',jsonb_build_object('task_id',tid,'path','src/evil.js','content','untrusted','fencing_token',lease->>'fencing_token'));assert r->>'error'='CHANNEL_ACCESS_DENIED','reviewer write';
 r:=public.aivault_collaboration('artifact_write','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'path','../escape','content','untrusted','fencing_token',lease->>'fencing_token'));assert r->>'error'='ARTIFACT_PATH_OR_SIZE_DENIED','path escape';
 r:=public.aivault_collaboration('artifact_write','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'path','src/file.txt','content',repeat('x',65537),'fencing_token',lease->>'fencing_token'));assert r->>'error'='ARTIFACT_PATH_OR_SIZE_DENIED','large file';
 r:=public.aivault_collaboration('artifact_write','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'path','src/support.txt','content','dry-run support fixture','fencing_token','0'));assert r->>'error'='ARTIFACT_WRITE_LEASE_DENIED','stale write fence';
 artifact:=public.aivault_collaboration('artifact_write','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'path','src/support.txt','content','dry-run support fixture','fencing_token',lease->>'fencing_token'));assert artifact->>'ok'='true','worker write';
 readback:=public.aivault_collaboration('artifact_read','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'artifact_id',artifact->>'artifact_id'));assert readback->>'content'='dry-run support fixture','readback mismatch';assert readback->>'sha256'=artifact->>'sha256','hash mismatch';
 r:=public.aivault_collaboration('artifact_read','fixture-worker-b','ch-0001',jsonb_build_object('task_id',tid,'artifact_id',artifact->>'artifact_id'));assert r->>'error'='TASK_NOT_ASSIGNED','other worker read';
 update public.ai_agent_channel_members set enabled=false where channel_id='ch-0001' and principal_id='fixture-worker-a';
 r:=public.aivault_collaboration('artifact_read','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'artifact_id',artifact->>'artifact_id'));assert r->>'error'='CHANNEL_ACCESS_DENIED','revoked member';
 update public.ai_agent_channel_members set enabled=true where channel_id='ch-0001' and principal_id='fixture-worker-a';
 r:=public.aivault_channel('finish','fixture-worker-a','ch-0001',jsonb_build_object('task_id',tid,'fencing_token',lease->>'fencing_token'));assert r->>'model_status'='BLOCKED_NO_MODEL','finish gate';
 r:=public.aivault_channel('status','base1','ch-0001',jsonb_build_object('task_id',tid));assert r->>'status'='blocked','first-base feedback';
 r:=public.aivault_channel('intake','base1','ch-1000',c||jsonb_build_object('command_id',prefix||'_last','nonce',prefix||'_last_nonce'));assert r->>'ok'='true','last channel intake';tid2:=(r->>'task_id')::uuid;
 update public.ai_agent_channels set max_pending=1 where id='ch-1000';
 r:=public.aivault_channel('intake','base1','ch-1000',c||jsonb_build_object('command_id',prefix||'_full','nonce',prefix||'_full_nonce'));assert r->>'error'='QUEUE_CAPACITY','queue cap';
 update public.ai_agent_channels set max_pending=16,enabled=false where id='ch-1000';
 r:=public.aivault_channel('status','base1','ch-1000',jsonb_build_object('task_id',tid2));assert r->>'error'='CHANNEL_DISABLED_OR_UNKNOWN','channel kill';
 update public.ai_agent_channels set enabled=true where id='ch-1000';
 assert not has_function_privilege('anon','public.aivault_channel(text,text,text,jsonb)','execute'),'anon channels';
 assert not has_function_privilege('authenticated','public.aivault_collaboration(text,text,text,jsonb)','execute'),'authenticated collaboration';
 assert not has_table_privilege('service_role','public.ai_agent_artifacts','update'),'artifact update';
 assert not has_table_privilege('service_role','public.ai_agent_channel_members','update'),'membership escalation';
 insert into public.ai_agent_events(event_type,detail) values('channel.collaboration_suite_passed',jsonb_build_object('channels',1000,'fixture_prefix',prefix,'mock_task_id',tid,'read_write',true,'dispatch',true,'model_status','BLOCKED_NO_MODEL','cross_base_network_connected',false));
end $$;
-- Fixture principals receive no host credentials and are disabled after testing.
update public.ai_agent_channel_members set enabled=false where principal_id in ('fixture-worker-a','fixture-worker-b','fixture-reviewer');
select id,event_type,detail from public.ai_agent_events where event_type='channel.collaboration_suite_passed' order by id desc limit 1;
