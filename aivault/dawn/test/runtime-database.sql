begin;
insert into public.ai_agent_runtime_principals(principal_id,token_sha256,principal_kind)
 values('fixture-dawn-controller',repeat('a',64),'controller'),('fixture-dawn-scheduler',repeat('b',64),'scheduler');
set local role service_role;
do $$
declare r jsonb; t text; l jsonb; run jsonb; q jsonb; prefix text:='runtime_'||replace(gen_random_uuid()::text,'-','');
begin
 assert not has_function_privilege('anon','public.aivault_dawn(text,text,jsonb)','execute');
 assert not has_table_privilege('authenticated','public.ai_agent_runtime_principals','select');
 r:=public.aivault_dawn_auth(repeat('a',64));assert r->>'ok'='true' and r->>'kind'='controller';
 r:=public.aivault_dawn_auth(repeat('c',64));assert r->>'error'='UNAUTHORIZED';
 q:=jsonb_build_object('kind','hash_text','question','曙光🌅','idempotency_key',prefix,'source','controller');
 r:=public.aivault_dawn('intake','fixture-dawn-scheduler',q);assert r->>'error'='ACTION_DENIED';
 r:=public.aivault_dawn('intake','fixture-dawn-controller',q);assert r->>'ok'='true';t:=r->>'task_id';
 r:=public.aivault_dawn('intake','fixture-dawn-controller',q);assert r->>'duplicate'='true';
 r:=public.aivault_dawn('intake','fixture-dawn-controller',q||'{"question":"changed"}');assert r->>'error'='IDEMPOTENCY_CONFLICT';
 r:=public.aivault_dawn('intake','fixture-dawn-controller',q||'{"repository":"protected"}');assert r->>'error'='MALFORMED_REQUEST';
 r:=public.aivault_dawn('intake','fixture-dawn-controller',q||'{"kind":"shell"}');assert r->>'error'='MALFORMED_REQUEST';
 l:=public.aivault_dawn('claim','fixture-dawn-scheduler',jsonb_build_object('task_id',t));assert l->>'ok'='true' and l->>'kind'='hash_text';
 r:=public.aivault_dawn('claim','fixture-dawn-controller',jsonb_build_object('task_id',t));assert r->>'idle'='true';
 r:=public.aivault_dawn('renew','fixture-dawn-scheduler',jsonb_build_object('task_id',t,'fencing_token','0'));assert r->>'error'='STALE_FENCING_OR_LEASE';
 r:=public.aivault_dawn('renew','fixture-dawn-scheduler',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token'));assert r->>'ok'='true';
 r:=public.aivault_dawn('model_reserve','fixture-dawn-scheduler',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token'));assert r->>'error'='BLOCKED_NO_MODEL';
 r:=public.aivault_dawn('finish','fixture-dawn-scheduler',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token','status','succeeded','evidence',jsonb_build_object('executor','fixture-only','inference_executed',false,'tool_execution',true,'result','fixture hash')));assert r->>'ok'='true';
 assert exists(select 1 from public.ai_agent_memory_entries where task_id=t::uuid and principal_id='dawn-runtime');
 r:=public.aivault_dawn('finish','fixture-dawn-scheduler',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token','status','succeeded','evidence','{}'::jsonb));assert r->>'error'='STALE_FENCING_OR_LEASE';
 r:=public.aivault_dawn('result','fixture-dawn-controller',jsonb_build_object('task_id',t));assert r#>>'{result,status}'='succeeded';
 r:=public.aivault_dawn('result','fixture-dawn-scheduler',jsonb_build_object('task_id',t));assert r->>'error'='ACTION_DENIED';
 r:=public.aivault_dawn('tick_start','fixture-dawn-scheduler','{}');assert r->>'ok'='true';
 run:=public.aivault_dawn('tick_start','fixture-dawn-controller','{}');assert run->>'error'='TICK_BUSY';
 run:=public.aivault_dawn('tick_end','fixture-dawn-scheduler',jsonb_build_object('tick_token',r->>'tick_token'));assert run->>'ok'='true';
 insert into public.ai_agent_events(event_type,detail) values('dawn.runtime_database_suite_passed','{"fixture_only":true,"live_control":true,"inference_executed":false,"rolled_back":true}');
end $$;
reset role;
update public.ai_agent_runtime_config set model_policy=jsonb_build_object('approved',true,'provider','gemini','model','fixture-only','billing_mode','free_only','quota_evidence_id','fixture-only','license_evidence_id','fixture-only','valid_until',clock_timestamp()+interval '5 minutes','context_transfer_authorized',false);
set local role service_role;
do $$ declare r jsonb;l jsonb;t text;begin
 r:=public.aivault_dawn('intake','fixture-dawn-controller',jsonb_build_object('kind','qa','question','private fixture','idempotency_key','context_gate_'||replace(gen_random_uuid()::text,'-',''),'source','controller'));t:=r->>'task_id';assert r->>'ok'='true';
 l:=public.aivault_dawn('claim','fixture-dawn-controller',jsonb_build_object('task_id',t));assert l->>'ok'='true';
 r:=public.aivault_dawn('model_reserve','fixture-dawn-controller',jsonb_build_object('task_id',t,'fencing_token',l->>'fencing_token'));assert r->>'error'='EXTERNAL_MODEL_CONTEXT_NOT_AUTHORIZED';
end $$;
select event_type,detail from public.ai_agent_events where event_type='dawn.runtime_database_suite_passed' order by id desc limit 1;
rollback;
