-- Dawn bounded live runtime. Existing ai_agent_tasks remains the only task queue.
create table public.ai_agent_runtime_config (
 instance_id text primary key check(instance_id='base-002:dawn-light'),
 enabled boolean not null default true,
 model_policy jsonb not null default '{"approved":false,"provider":"gemini","model":null,"billing_mode":"free_only"}',
 last_poll_at timestamptz not null default '2026-10-21T00:00:00Z',
 last_tick_at timestamptz,
 busy_until timestamptz,
 tick_token uuid,
 request_day date not null default current_date,
 requests integer not null default 0 check(requests between 0 and 500),
 daily_limit integer not null default 200 check(daily_limit between 1 and 500)
 ,model_day date not null default current_date
 ,model_calls integer not null default 0 check(model_calls between 0 and 16)
);
create table public.ai_agent_runtime_principals (
 principal_id text primary key,
 token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
 principal_kind text not null check(principal_kind in ('controller','scheduler')),
 enabled boolean not null default true,
 expires_at timestamptz
);
create table public.ai_agent_inbox_receipts (
 source_comment_id text primary key check(source_comment_id ~ '^[0-9]{1,20}$'),
 message_id text unique,
 content_sha256 text not null,
 source_author_id bigint not null,
 state text not null check(state in ('accepted','ignored','rejected')),
 reason text not null,
 task_id uuid references public.ai_agent_tasks,
 received_at timestamptz not null default now()
);
create table public.ai_agent_outbox (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.ai_agent_tasks,
 kind text not null check(kind in ('result','help_request')),
 marker text not null unique,
 body text not null check(char_length(body) between 1 and 12000),
 status text not null default 'pending' check(status in ('pending','sending','sent','unknown','blocked')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 comment_id text,
 updated_at timestamptz not null default now(),
 unique(task_id,kind)
);
alter table public.ai_agent_runtime_config enable row level security;
alter table public.ai_agent_runtime_principals enable row level security;
alter table public.ai_agent_inbox_receipts enable row level security;
alter table public.ai_agent_outbox enable row level security;
revoke all on public.ai_agent_runtime_config,public.ai_agent_runtime_principals,public.ai_agent_inbox_receipts,public.ai_agent_outbox from public,anon,authenticated,service_role;
grant select on public.ai_agent_runtime_config,public.ai_agent_runtime_principals,public.ai_agent_inbox_receipts,public.ai_agent_outbox to service_role;
grant update(last_poll_at,last_tick_at,busy_until,tick_token,request_day,requests,model_day,model_calls) on public.ai_agent_runtime_config to service_role;
grant insert on public.ai_agent_inbox_receipts,public.ai_agent_outbox to service_role;
grant update(status,attempts,comment_id,updated_at) on public.ai_agent_outbox to service_role;
alter table public.ai_agent_tasks add column dawn_attempts integer not null default 0 check(dawn_attempts between 0 and 3);
insert into public.ai_agent_runtime_config(instance_id) values('base-002:dawn-light');
insert into public.ai_agent_memory_members(instance_id,principal_id,member_kind,can_read,can_write)
 values('base-002:dawn-light','dawn-runtime','reader',true,false);

create function public.aivault_dawn_auth(p_digest text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare p public.ai_agent_runtime_principals%rowtype;c public.ai_agent_runtime_config%rowtype;
begin
 select * into p from public.ai_agent_runtime_principals where token_sha256=p_digest and enabled and (expires_at is null or expires_at>clock_timestamp());
 if p.principal_id is null then return '{"ok":false,"error":"UNAUTHORIZED"}';end if;
 select * into c from public.ai_agent_runtime_config where instance_id='base-002:dawn-light' for update;
 if c.request_day<>current_date then c.requests:=0;end if;
 if c.requests>=c.daily_limit then return '{"ok":false,"error":"DAILY_RUNTIME_LIMIT"}';end if;
 update public.ai_agent_runtime_config set requests=c.requests+1,request_day=current_date where instance_id=c.instance_id;
 return jsonb_build_object('ok',true,'principal',p.principal_id,'kind',p.principal_kind,'enabled',c.enabled);
end $$;
revoke all on function public.aivault_dawn_auth(text) from public,anon,authenticated;
grant execute on function public.aivault_dawn_auth(text) to service_role;

create or replace function public.aivault_dawn(p_action text,p_principal text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
set lock_timeout='1s' set statement_timeout='5s' as $$
declare
 c public.ai_agent_runtime_config%rowtype;p public.ai_agent_runtime_principals%rowtype;
 t public.ai_agent_tasks%rowtype;l public.ai_agent_leases%rowtype;
 rec public.ai_agent_inbox_receipts%rowtype;r uuid;err text;rowdata jsonb;
 now_at timestamptz:=clock_timestamp();q text;k text;key text;mode text;mem text;
begin
 select * into p from public.ai_agent_runtime_principals where principal_id=p_principal and enabled and (expires_at is null or expires_at>now_at);
 if p.principal_id is null then return '{"ok":false,"error":"UNAUTHORIZED"}';end if;
 select * into c from public.ai_agent_runtime_config where instance_id='base-002:dawn-light';
 if p_action='status' then
  return jsonb_build_object('ok',true,'instance_id',c.instance_id,'enabled',c.enabled,'last_tick_at',c.last_tick_at,'last_poll_at',c.last_poll_at,'model_policy',c.model_policy,
   'memory',public.aivault_memory('status','dawn-runtime',c.instance_id,'{}'),
   'tasks',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.ai_agent_tasks where source='dawn-runtime' group by status)x),
   'outbox',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.ai_agent_outbox group by status)x));
 end if;
 if not c.enabled then return '{"ok":false,"error":"KILL_SWITCH"}';end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>65536 then err:='MALFORMED_REQUEST';
 elsif p_action='tick_start' then
  select * into c from public.ai_agent_runtime_config where instance_id=c.instance_id for update;
  if c.busy_until>now_at then return '{"ok":false,"error":"TICK_BUSY"}';end if;
  update public.ai_agent_runtime_config set last_tick_at=now_at,busy_until=now_at+interval '90 seconds',tick_token=gen_random_uuid() where instance_id=c.instance_id returning tick_token into r;
  insert into public.ai_agent_events(event_type,detail) values('dawn.runtime_tick',jsonb_build_object('principal',p_principal,'tick',r));
  return jsonb_build_object('ok',true,'tick_token',r,'last_poll_at',c.last_poll_at);
 elsif p_action='tick_end' then
  update public.ai_agent_runtime_config set busy_until=null where instance_id=c.instance_id and tick_token::text=p_body->>'tick_token';
  return jsonb_build_object('ok',found);
 elsif p_action='poll_checkpoint' then
  if p_body->>'through' ~ '^[0-9TZ:+. -]+$' then
   update public.ai_agent_runtime_config set last_poll_at=greatest(last_poll_at,(p_body->>'through')::timestamptz) where instance_id=c.instance_id;
   return '{"ok":true}';end if;err:='MALFORMED_REQUEST';
 elsif p_action in ('intake','receipt') then
  -- Authenticated HTTP controller or verified fixed-inbox adapter, never shell.
  if p_action='intake' then
   if p.principal_kind<>'controller' and p_body->>'source' is distinct from 'github' then return '{"ok":false,"error":"ACTION_DENIED"}';end if;
   if p_body-array['kind','question','idempotency_key','source','message_id','comment_id','content_sha256','author_id']::text[]<>'{}'::jsonb
     or coalesce(p_body->>'kind','') not in ('qa','memory_status','hash_text')
     or jsonb_typeof(p_body->'question') is distinct from 'string' or char_length(p_body->>'question')>8000
     or coalesce(p_body->>'idempotency_key','') !~ '^[A-Za-z0-9_-]{8,128}$'
     or p_body->>'source' not in ('controller','github') then err:='MALFORMED_REQUEST';
   elsif p_body->>'source'='github' and (p_body->>'author_id' is distinct from '306819786' or coalesce(p_body->>'comment_id','') !~ '^[0-9]{1,20}$' or coalesce(p_body->>'message_id','') !~ '^[A-Za-z0-9_.:-]{8,160}$') then err:='SOURCE_DENIED';
   else
    perform pg_advisory_xact_lock(17412,1000);
    key:='dawn_'||(p_body->>'idempotency_key');
    select * into t from public.ai_agent_tasks where command_id=key;
    if t.id is not null then
     if t.payload->'command' is not distinct from p_body then return jsonb_build_object('ok',true,'duplicate',true,'task_id',t.id);end if;
     return '{"ok":false,"error":"IDEMPOTENCY_CONFLICT"}';
    end if;
    if (select count(*) from public.ai_agent_tasks where status in ('queued','leased') and expires_at>now_at)>=128 then return '{"ok":false,"error":"QUEUE_CAPACITY"}';end if;
    if p_body->>'source'='github' then
     select * into rec from public.ai_agent_inbox_receipts where source_comment_id=p_body->>'comment_id' or message_id=p_body->>'message_id';
     if rec.source_comment_id is not null then return '{"ok":false,"error":"REPLAY_OR_EDITED_MESSAGE"}';end if;
    end if;
    insert into public.ai_agent_tasks(command_id,source,repository,task_type,payload,expires_at,channel_claimed_by,channel_assigned_to)
     values(key,'dawn-runtime','NL13741619-commits/homework-helper','dawn_'||(p_body->>'kind'),jsonb_build_object('instance_id',c.instance_id,'command',p_body),now_at+interval '24 hours','dawn-runtime','dawn-runtime') returning * into t;
    if p_body->>'source'='github' then
     insert into public.ai_agent_inbox_receipts(source_comment_id,message_id,content_sha256,source_author_id,state,reason,task_id)
      values(p_body->>'comment_id',p_body->>'message_id',p_body->>'content_sha256',306819786,'accepted','fixed bounded Dawn task',t.id);
    end if;
    insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'dawn.task_accepted',jsonb_build_object('principal',p_principal,'kind',p_body->>'kind','source',p_body->>'source'));
    return jsonb_build_object('ok',true,'task_id',t.id,'status',t.status);
   end if;
  else
   if coalesce(p_body->>'comment_id','') !~ '^[0-9]{1,20}$' or p_body->>'state' not in ('ignored','rejected') or char_length(p_body->>'reason')>200 then err:='MALFORMED_REQUEST';
   else
    insert into public.ai_agent_inbox_receipts(source_comment_id,content_sha256,source_author_id,state,reason)
     values(p_body->>'comment_id',p_body->>'content_sha256',coalesce((p_body->>'author_id')::bigint,0),p_body->>'state',p_body->>'reason') on conflict do nothing;
    return '{"ok":true}';
   end if;
  end if;
 elsif p_action='claim' then
  perform pg_advisory_xact_lock(17412,1000);
  if (select count(*) from public.ai_agent_leases where expires_at>now_at)>=8 then return '{"ok":false,"error":"RUNNER_CAPACITY"}';end if;
  select q.* into t from public.ai_agent_tasks q where q.source='dawn-runtime' and q.status in ('queued','leased') and q.dawn_attempts<3 and q.expires_at>now_at
   and (not(p_body?'task_id') or q.id::text=p_body->>'task_id') and not exists(select 1 from public.ai_agent_leases x where x.task_id=q.id and x.expires_at>now_at)
   order by q.created_at for update skip locked limit 1;
  if t.id is null then return '{"ok":true,"idle":true}';end if;
  update public.ai_agent_runs set status='cancelled',finished_at=now_at where task_id=t.id and status='started';
  insert into public.ai_agent_leases(task_id,runner_id,expires_at) values(t.id,'dawn-runtime',least(t.expires_at,now_at+interval '90 seconds'))
   on conflict(task_id) do update set runner_id='dawn-runtime',fencing_token=default,acquired_at=now_at,expires_at=excluded.expires_at returning * into l;
  update public.ai_agent_tasks set status='leased',dawn_attempts=dawn_attempts+1,updated_at=now_at where id=t.id;
  insert into public.ai_agent_runs(task_id,runner_id,branch_name,evidence) values(t.id,'dawn-runtime','feature/aivault-rebuild',jsonb_build_object('instance_id',c.instance_id,'fencing_token',l.fencing_token::text,'bounded_tools',true)) returning id into r;
  insert into public.ai_agent_events(task_id,run_id,event_type,detail) values(t.id,r,'dawn.claimed',jsonb_build_object('fencing_token',l.fencing_token::text));
  return jsonb_build_object('ok',true,'task_id',t.id,'run_id',r,'fencing_token',l.fencing_token::text,'lease_expires_at',l.expires_at,'kind',t.payload#>>'{command,kind}','question',t.payload#>>'{command,question}','model_policy',c.model_policy);
 elsif p_action in ('renew','finish','model_reserve') then
  select * into t from public.ai_agent_tasks where id::text=p_body->>'task_id' and source='dawn-runtime' for update;
  select * into l from public.ai_agent_leases where task_id=t.id for update;
  if t.id is null or t.status<>'leased' or t.expires_at<=clock_timestamp() or l.runner_id is distinct from 'dawn-runtime' or l.expires_at<=clock_timestamp() or l.fencing_token::text is distinct from p_body->>'fencing_token' then err:='STALE_FENCING_OR_LEASE';
  elsif p_action='model_reserve' then
   select * into c from public.ai_agent_runtime_config where instance_id=c.instance_id for update;
   if c.model_policy->>'approved' is distinct from 'true' or c.model_policy->>'billing_mode' is distinct from 'free_only'
    or coalesce(c.model_policy->>'provider','') not in ('gemini','qwen_self_hosted')
    or coalesce(c.model_policy->>'quota_evidence_id','')='' or coalesce(c.model_policy->>'license_evidence_id','')=''
    or coalesce(c.model_policy->>'valid_until','') !~ '^[0-9]{4}-' then return '{"ok":false,"error":"BLOCKED_NO_MODEL"}';end if;
   if (c.model_policy->>'valid_until')::timestamptz<=clock_timestamp() then return '{"ok":false,"error":"BLOCKED_NO_MODEL"}';end if;
   if c.model_day<>current_date then c.model_calls:=0;end if;
   if c.model_calls>=16 then return '{"ok":false,"error":"MODEL_DAILY_LIMIT"}';end if;
   if exists(select 1 from public.ai_agent_events where task_id=t.id and event_type='dawn.model_reserved') then return '{"ok":false,"error":"MODEL_ALREADY_RESERVED_REVIEW_REQUIRED"}';end if;
   update public.ai_agent_runtime_config set model_day=current_date,model_calls=c.model_calls+1 where instance_id=c.instance_id;
   r:=gen_random_uuid();
   insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'dawn.model_reserved',jsonb_build_object('request_id',r,'fencing_token',l.fencing_token::text,'provider',c.model_policy->>'provider','model',c.model_policy->>'model','quota_evidence_id',c.model_policy->>'quota_evidence_id'));
   return jsonb_build_object('ok',true,'request_id',r,'policy',c.model_policy);
  elsif p_action='renew' then
   update public.ai_agent_leases set expires_at=least(t.expires_at,clock_timestamp()+interval '90 seconds') where task_id=t.id;
   return '{"ok":true}';
  elsif p_body->>'status' not in ('succeeded','failed','blocked') or jsonb_typeof(p_body->'evidence') is distinct from 'object' or octet_length((p_body->'evidence')::text)>32000 then err:='MALFORMED_REQUEST';
  else
   update public.ai_agent_tasks set status=p_body->>'status',updated_at=clock_timestamp() where id=t.id;
   update public.ai_agent_leases set expires_at=clock_timestamp() where task_id=t.id;
   update public.ai_agent_runs set status=p_body->>'status',finished_at=clock_timestamp(),evidence=evidence||(p_body->'evidence') where task_id=t.id and status='started' returning id into r;
   insert into public.ai_agent_events(task_id,run_id,event_type,detail) values(t.id,r,'dawn.finished',p_body->'evidence');
   if p_body#>>'{evidence,inference_executed}'='true' then
    insert into public.ai_model_usage(task_id,run_id,provider,model,input_units,output_units,estimated_cost_usd)
     values(t.id,r,c.model_policy->>'provider',c.model_policy->>'model',coalesce((p_body#>>'{evidence,input_units}')::bigint,0),coalesce((p_body#>>'{evidence,output_units}')::bigint,0),0);
   end if;
   -- Fenced append of a bounded task outcome, never model-supplied authority.
   mem:=left(jsonb_build_object('task_id',t.id,'status',p_body->>'status','evidence',p_body->'evidence')::text,8000);
   begin
    insert into public.ai_agent_memory_entries(instance_id,principal_id,idempotency_key,title,content,source_ref,task_id,fencing_token)
     values(c.instance_id,'dawn-runtime','runtime_'||replace(t.id::text,'-',''),'任務結果 '||t.id,mem,'task:'||t.id,t.id,l.fencing_token);
   exception when check_violation or unique_violation then
    insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'dawn.memory_append_blocked','{}');
   end;
   if t.payload#>>'{command,source}'='github' or p_body->>'status'='blocked' then
    mode:=case when p_body->>'status'='blocked' then 'help_request' else 'result' end;
    key:='aivault-dawn-'||t.id||'-'||mode;
    insert into public.ai_agent_outbox(task_id,kind,marker,body) values(t.id,mode,key,
      '<!-- '||key||' -->'||E'\n'||jsonb_build_object('from_base','base-002','to_base','base-001','recipient_agent','technical-dark-star','reply_to','https://github.com/NL13741619-commits/homework-helper/issues/1','kind',mode,'task_id',t.id,'source_message_id',t.payload#>>'{command,message_id}','executor','base-002:dawn-light bounded runtime','status',p_body->>'status','evidence',p_body->'evidence')::text)
     on conflict(task_id,kind) do nothing;
   end if;
   return jsonb_build_object('ok',true,'task_id',t.id,'status',p_body->>'status','run_id',r);
  end if;
 elsif p_action='result' and p.principal_kind='controller' then
  select jsonb_build_object('task_id',q.id,'status',q.status,'runs',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'evidence',x.evidence,'finished_at',x.finished_at)),'[]') from public.ai_agent_runs x where x.task_id=q.id)) into rowdata
   from public.ai_agent_tasks q where q.id::text=p_body->>'task_id' and q.source='dawn-runtime';
  return jsonb_build_object('ok',rowdata is not null,'result',rowdata);
 elsif p_action='outbox_next' then
  select to_jsonb(x) into rowdata from public.ai_agent_outbox x where (status in ('pending','blocked') and attempts<3) or status in ('sending','unknown') order by updated_at limit 1;
  return jsonb_build_object('ok',true,'item',rowdata);
 elsif p_action='outbox_state' then
  if p_body->>'status' not in ('sending','sent','unknown','blocked') then err:='MALFORMED_REQUEST';
  else
   update public.ai_agent_outbox set status=p_body->>'status',attempts=attempts+case when p_body->>'status'='sending' then 1 else 0 end,
    comment_id=coalesce(p_body->>'comment_id',comment_id),updated_at=now_at where id::text=p_body->>'id' and status<>'sent' and (p_body->>'status'<>'sending' or attempts<3);
   return jsonb_build_object('ok',found);
  end if;
 elsif p_action='resume' and (p.principal_kind='controller' or p_body->>'verified_main_sender'='306819786') then
  if p.principal_kind<>'controller' then
   if coalesce(p_body->>'comment_id','') !~ '^[0-9]{1,20}$' or coalesce(p_body->>'message_id','') !~ '^[A-Za-z0-9_.:-]{8,160}$' then return '{"ok":false,"error":"INVALID_RESUME_REPLY"}';end if;
   if exists(select 1 from public.ai_agent_inbox_receipts where source_comment_id=p_body->>'comment_id' or message_id=p_body->>'message_id') then return '{"ok":false,"error":"REPLAY_OR_EDITED_MESSAGE"}';end if;
  end if;
  update public.ai_agent_tasks set status='queued',updated_at=now_at where id::text=p_body->>'task_id' and source='dawn-runtime' and status='blocked' and dawn_attempts<3 and expires_at>now_at;
  if not found then return '{"ok":false,"error":"TASK_NOT_RESUMABLE"}';end if;
  if p.principal_kind<>'controller' then
   insert into public.ai_agent_inbox_receipts(source_comment_id,message_id,content_sha256,source_author_id,state,reason,task_id)
    values(p_body->>'comment_id',p_body->>'message_id',p_body->>'content_sha256',306819786,'accepted','correlated help response resume',(p_body->>'task_id')::uuid);
  end if;
  return '{"ok":true}';
 else err:='ACTION_DENIED';end if;
 insert into public.ai_agent_events(event_type,detail) values('dawn.runtime_rejected',jsonb_build_object('reason',err,'principal',p_principal));
 return jsonb_build_object('ok',false,'error',err);
end $$;
revoke all on function public.aivault_dawn(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aivault_dawn(text,text,jsonb) to service_role;

-- Include unscoped Dawn tasks in the SAME global channel admission/lease caps.
-- Preserve the currently deployed channel function, including prior hardening.
do $$ declare definition text;begin
 select pg_get_functiondef('public.aivault_channel(text,text,text,jsonb)'::regprocedure) into definition;
 if strpos(definition,'where q.channel_id is not null and q.id<>t.id')=0 and strpos(definition,'where q.id<>t.id')=0 then raise exception 'Review current channel capacity implementation';end if;
 definition:=replace(definition,'where q.channel_id is not null and q.id<>t.id','where q.id<>t.id');
 definition:=replace(definition,'where channel_id is not null and status in','where status in');
 execute definition;
end $$;
