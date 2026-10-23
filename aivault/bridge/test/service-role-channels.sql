-- Entire validation is rolled back; caller must not remove this transaction.
begin;
update public.ai_agent_channel_members set enabled=true where channel_id='ch-0001' and principal_id='fixture-worker-a';
set local role service_role;
do $$
declare c jsonb;r jsonb;t uuid;l jsonb;a jsonb;prefix text:='role_channel_'||replace(gen_random_uuid()::text,'-','');
begin
 c:=jsonb_build_object('command_id',prefix,'nonce',prefix||'_nonce','sender','base1','recipient','base2','issued_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '5 minutes','task_type','dry_run',
 'payload',jsonb_build_object('repository','NL13741619-commits/homework-helper','project_ref','svtkpdmqemidlasowqew','branch','feature/aivault-rebuild','mode','mock','model','none','tests',jsonb_build_array('bridge_contract_v1')));
 r:=public.aivault_channel('intake','base1','ch-0001',c);assert r->>'ok'='true','service intake';t:=(r->>'task_id')::uuid;
 r:=public.aivault_collaboration('dispatch','base2-controller','ch-0001',jsonb_build_object('task_id',t,'assignee','fixture-worker-a'));assert r->>'ok'='true','service dispatch';
 l:=public.aivault_channel('claim','fixture-worker-a','ch-0001',jsonb_build_object('task_id',t));assert l->>'ok'='true','service claim';
 a:=public.aivault_collaboration('artifact_write','fixture-worker-a','ch-0001',jsonb_build_object('task_id',t,'path','src/role-fixture.txt','content','service-role read/write test','fencing_token',l->>'fencing_token'));assert a->>'ok'='true','service write';
 r:=public.aivault_collaboration('artifact_read','base1','ch-0001',jsonb_build_object('task_id',t,'artifact_id',a->>'artifact_id'));assert r->>'content'='service-role read/write test','service read';
 r:=public.aivault_channel('finish','fixture-worker-a','ch-0001',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token'));assert r->>'model_status'='BLOCKED_NO_MODEL','service finish';
 insert into public.ai_agent_events(event_type,detail) values('channel.service_role_suite_passed','{"read_write":true,"dispatch":true,"inference":false}'::jsonb);
end $$;
select id,event_type,detail from public.ai_agent_events where event_type='channel.service_role_suite_passed' order by id desc limit 1;
rollback;
