-- AIVAULT second base only. Additive; no bridge queue, legacy changes, or definer.
alter table public.ai_agent_tasks add column if not exists bridge_sender text;
alter table public.ai_agent_tasks add column if not exists bridge_nonce text;
alter table public.ai_agent_tasks add column if not exists expires_at timestamptz;
create unique index if not exists ai_agent_bridge_nonce on public.ai_agent_tasks(bridge_sender,bridge_nonce) where bridge_sender is not null;

-- Service-side authenticated actor MUST come from a verified credential, never payload.
-- SQL is a second validation boundary. All rejected operations append evidence.
create or replace function public.aivault_bridge(p_action text,p_actor text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
set statement_timeout = '3s' set lock_timeout = '1s' as $$
declare
 t public.ai_agent_tasks%rowtype;
 l public.ai_agent_leases%rowtype;
 v_run uuid;
 v_error text;
 v_exp timestamptz;
 v_now timestamptz := clock_timestamp();
begin
 if p_actor not in ('base1','runner-dry-run') or p_actor is null then v_error:='UNAUTHORIZED_SENDER';
 elsif p_body is null or jsonb_typeof(p_body) <> 'object' or octet_length(p_body::text)>16384 then v_error:='MALFORMED_PAYLOAD';
 elsif p_action='intake' and p_actor='base1' then
  if (select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from
    array['command_id','expires_at','issued_at','nonce','payload','recipient','sender','task_type']::text[]
    or p_body->>'sender' is distinct from p_actor or p_body->>'recipient' is distinct from 'base2'
    or p_body->>'task_type' is distinct from 'dry_run'
    or jsonb_typeof(p_body->'command_id') is distinct from 'string'
    or jsonb_typeof(p_body->'nonce') is distinct from 'string'
    or jsonb_typeof(p_body->'issued_at') is distinct from 'string'
    or jsonb_typeof(p_body->'expires_at') is distinct from 'string'
    or coalesce(p_body->>'command_id','') !~ '^[a-zA-Z0-9_-]{8,128}$'
    or coalesce(p_body->>'nonce','') !~ '^[a-zA-Z0-9_-]{16,128}$'
    or jsonb_typeof(p_body->'payload') is distinct from 'object' then v_error:='MALFORMED_PAYLOAD';
  elsif (select array_agg(key order by key) from jsonb_object_keys(p_body->'payload') key) is distinct from
    array['branch','mode','model','project_ref','repository','tests']::text[] then v_error:='MALFORMED_PAYLOAD';
  elsif p_body#>>'{payload,repository}' is distinct from 'NL13741619-commits/homework-helper'
    or p_body#>>'{payload,project_ref}' is distinct from 'svtkpdmqemidlasowqew' then v_error:='PROTECTED_TARGET';
  elsif p_body#>>'{payload,branch}' is distinct from 'feature/aivault-rebuild' then v_error:='DIRECT_MAIN_OR_BRANCH_DENIED';
  elsif p_body#>>'{payload,model}' is distinct from 'none' then v_error:='MODEL_REQUEST_DENIED';
  elsif p_body#>>'{payload,mode}' is distinct from 'mock'
    or p_body#>'{payload,tests}' is distinct from '["bridge_contract_v1"]'::jsonb then v_error:='PAYLOAD_POLICY_DENIED';
  else
   begin
    v_exp := (p_body->>'expires_at')::timestamptz;
    if not isfinite(v_exp) or not isfinite((p_body->>'issued_at')::timestamptz)
       or v_exp<=v_now or v_exp>v_now+interval '10 minutes'
       or (p_body->>'issued_at')::timestamptz>v_now+interval '30 seconds'
       or (p_body->>'issued_at')::timestamptz<v_now-interval '5 minutes'
       or v_exp<=(p_body->>'issued_at')::timestamptz
       or p_body->>'issued_at' is null or v_exp is null then v_error:='EXPIRED_COMMAND'; end if;
   exception when invalid_datetime_format or datetime_field_overflow then v_error:='MALFORMED_PAYLOAD'; end;
   if v_error is null then
    insert into public.ai_agent_tasks(command_id,source,repository,task_type,payload,bridge_sender,bridge_nonce,expires_at)
    values(p_body->>'command_id','bridge',p_body#>>'{payload,repository}','dry_run',p_body,p_actor,p_body->>'nonce',v_exp)
    on conflict do nothing returning * into t;
    if t.id is null then v_error:='DUPLICATE_OR_REPLAY';
    else
     insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'bridge.accepted',jsonb_build_object('actor',p_actor,'command_id',t.command_id));
     return jsonb_build_object('ok',true,'task_id',t.id,'status',t.status);
    end if;
   end if;
  end if;
 elsif p_action in ('claim','finish') and p_actor='runner-dry-run' then
  if coalesce(p_body->>'task_id','') !~ '^[0-9a-f-]{36}$'
    or (p_action='claim' and p_body - 'task_id' <> '{}'::jsonb)
    or (p_action='finish' and ((select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['fencing_token','task_id']::text[]
       or coalesce(p_body->>'fencing_token','') !~ '^[0-9]{1,19}$')) then v_error:='MALFORMED_PAYLOAD';
  else
   begin
    select * into t from public.ai_agent_tasks where id=(p_body->>'task_id')::uuid and source='bridge' for update;
   exception when invalid_text_representation then v_error:='MALFORMED_PAYLOAD'; end;
   if v_error is null then
    v_now := clock_timestamp();
    if t.id is null then v_error:='NOT_FOUND';
    elsif t.expires_at is null or t.expires_at<=v_now then v_error:='TASK_EXPIRED';
    elsif p_action='claim' then
     select * into l from public.ai_agent_leases where task_id=t.id;
     if t.status not in ('queued','leased') or (l.task_id is not null and l.expires_at>v_now) then v_error:='LEASE_CONFLICT';
     else
      -- Task row lock serializes claim/reclaim/finish. Identity always yields a fresh fence.
      if l.task_id is not null then
       update public.ai_agent_runs set status='cancelled',finished_at=v_now where task_id=t.id and status='started';
       update public.ai_agent_leases set fencing_token=default,runner_id=p_actor,acquired_at=v_now,
        expires_at=least(t.expires_at,v_now+interval '30 seconds') where task_id=t.id returning * into l;
      else
       insert into public.ai_agent_leases(task_id,runner_id,expires_at) values(t.id,p_actor,least(t.expires_at,v_now+interval '30 seconds')) returning * into l;
      end if;
      update public.ai_agent_tasks set status='leased',updated_at=v_now where id=t.id;
      insert into public.ai_agent_runs(task_id,runner_id,branch_name,evidence) values(t.id,p_actor,'feature/aivault-rebuild',jsonb_build_object('mock',true,'fencing_token',l.fencing_token::text)) returning id into v_run;
      insert into public.ai_agent_events(task_id,run_id,event_type,detail) values(t.id,v_run,'bridge.claimed',jsonb_build_object('fencing_token',l.fencing_token::text,'expires_at',l.expires_at));
      return jsonb_build_object('ok',true,'task_id',t.id,'run_id',v_run,'fencing_token',l.fencing_token::text,'lease_expires_at',l.expires_at);
     end if;
    else
     select * into l from public.ai_agent_leases where task_id=t.id;
     if t.status<>'leased' or l.task_id is null or l.expires_at<=v_now or l.runner_id<>p_actor
       or l.fencing_token::text is distinct from p_body->>'fencing_token' then v_error:='STALE_FENCING_OR_LEASE';
     else
      update public.ai_agent_tasks set status='blocked',updated_at=v_now where id=t.id;
      update public.ai_agent_runs set status='blocked',finished_at=v_now,
        evidence=evidence||'{"mock":true,"model_status":"BLOCKED_NO_MODEL","inference_executed":false,"code_execution":false}'::jsonb
        where task_id=t.id and status='started' returning id into v_run;
      insert into public.ai_agent_events(task_id,run_id,event_type,detail) values(t.id,v_run,'bridge.dry_run_finished','{"model_status":"BLOCKED_NO_MODEL","inference_executed":false,"code_execution":false}'::jsonb);
      return jsonb_build_object('ok',true,'task_id',t.id,'status','blocked','model_status','BLOCKED_NO_MODEL');
     end if;
    end if;
   end if;
  end if;
 else v_error:='ACTION_DENIED'; end if;
 insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'bridge.rejected',jsonb_build_object('reason',v_error,'action',left(p_action,24)));
 return jsonb_build_object('ok',false,'error',v_error);
end $$;
revoke all on function public.aivault_bridge(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aivault_bridge(text,text,jsonb) to service_role;
-- Backend audit writer can append/read evidence, never rewrite or truncate it.
revoke update,delete,truncate on public.ai_agent_events from service_role;
