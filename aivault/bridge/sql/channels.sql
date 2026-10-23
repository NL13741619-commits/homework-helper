-- 1,000 routing/authorization records, NOT a second task queue.
create table public.ai_agent_channels (
 id text primary key check (id ~ '^ch-[0-9]{4}$'),
 ordinal integer not null unique check (ordinal between 1 and 1000),
 source_base text not null default 'base1' check(source_base='base1'),
 recipient_base text not null default 'base2' check(recipient_base='base2'),
 enabled boolean not null default true,
 mode text not null default 'dry_run' check(mode='dry_run'),
 max_pending integer not null default 16 check(max_pending between 1 and 16),
 max_running integer not null default 1 check(max_running=1),
 created_at timestamptz not null default now()
);
create table public.ai_agent_channel_members (
 channel_id text not null references public.ai_agent_channels(id),
 principal_id text not null check(principal_id ~ '^[A-Za-z0-9_-]{3,128}$'),
 member_kind text not null default 'worker' check(member_kind in ('controller','bridge','worker','reviewer')),
 actions text[] not null check(actions <@ array['intake','claim','finish','status','dispatch','inbox','artifact_read','artifact_write']::text[] and cardinality(actions)>0),
 enabled boolean not null default true,
 expires_at timestamptz,
 primary key(channel_id,principal_id)
);
alter table public.ai_agent_channels enable row level security;
alter table public.ai_agent_channel_members enable row level security;
revoke all on public.ai_agent_channels,public.ai_agent_channel_members from public,anon,authenticated;
grant select on public.ai_agent_channels,public.ai_agent_channel_members to service_role;
-- Trusted gateway can read ACLs; provisioning/revocation requires an administrator.
revoke insert,update,delete,truncate on public.ai_agent_channels,public.ai_agent_channel_members from service_role;

insert into public.ai_agent_channels(id,ordinal)
 select 'ch-'||lpad(n::text,4,'0'),n from generate_series(1,1000) n;
insert into public.ai_agent_channel_members(channel_id,principal_id,member_kind,actions)
 select id,'base1','bridge',array['intake','status','inbox','artifact_read','artifact_write']::text[] from public.ai_agent_channels;
insert into public.ai_agent_channel_members(channel_id,principal_id,member_kind,actions)
 select id,'runner-dry-run','worker',array['claim','finish','status','artifact_read','artifact_write']::text[] from public.ai_agent_channels;
insert into public.ai_agent_channel_members(channel_id,principal_id,member_kind,actions)
 select id,'base2-controller','controller',array['intake','status','dispatch','inbox','artifact_read','artifact_write']::text[] from public.ai_agent_channels;

alter table public.ai_agent_tasks add column channel_id text references public.ai_agent_channels(id);
alter table public.ai_agent_tasks add column channel_claimed_by text;
alter table public.ai_agent_tasks add column channel_assigned_to text;
create index ai_agent_channel_queue on public.ai_agent_tasks(channel_id,status,created_at) where channel_id is not null;

create or replace function public.aivault_channel(p_action text,p_principal text,p_channel text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
set statement_timeout='3s' set lock_timeout='1s' as $$
declare
 c public.ai_agent_channels%rowtype;
 m public.ai_agent_channel_members%rowtype;
 t public.ai_agent_tasks%rowtype;
 r jsonb;
 err text;
 now_at timestamptz;
 previous_scope text;
begin
 if p_principal is null or p_principal !~ '^[A-Za-z0-9_-]{3,128}$'
   or p_channel is null or p_channel !~ '^ch-[0-9]{4}$'
   or p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>16384 then err:='MALFORMED_CHANNEL_REQUEST';
 else
  -- Recheck current channel/ACL on every operation; in-flight work is bounded.
  select * into c from public.ai_agent_channels where id=p_channel;
  select * into m from public.ai_agent_channel_members where channel_id=p_channel and principal_id=p_principal;
  now_at:=clock_timestamp();
  if c.id is null or not c.enabled then err:='CHANNEL_DISABLED_OR_UNKNOWN';
  elsif m.principal_id is null or not m.enabled or (m.expires_at is not null and m.expires_at<=now_at)
    or p_action is null or not(p_action=any(m.actions)) then err:='CHANNEL_ACCESS_DENIED';
  elsif p_action='intake' then
   -- Serialize admission so concurrent hosts cannot overrun the DB-wide cap.
   perform pg_advisory_xact_lock(17412,1000);
   now_at:=clock_timestamp();
   if (select count(*) from public.ai_agent_tasks where channel_id=p_channel and status in ('queued','leased') and expires_at>now_at)>=c.max_pending
     or (select count(*) from public.ai_agent_tasks where status in ('queued','leased') and expires_at>now_at)>=128 then err:='QUEUE_CAPACITY';
   else
    r:=public.aivault_bridge('intake','base1',p_body);
    if r->>'ok'='true' then
     update public.ai_agent_tasks set channel_id=p_channel where id=(r->>'task_id')::uuid;
     insert into public.ai_agent_events(task_id,event_type,detail) values((r->>'task_id')::uuid,'channel.accepted',jsonb_build_object('channel_id',p_channel,'principal_id',p_principal));
     return r||jsonb_build_object('channel_id',p_channel);
    else return r; end if;
   end if;
  elsif p_action in ('claim','finish','status') then
   if coalesce(p_body->>'task_id','') !~ '^[0-9a-f-]{36}$' then err:='MALFORMED_CHANNEL_REQUEST';
   elsif (p_action in ('claim','status') and p_body-'task_id'<>'{}'::jsonb)
      or (p_action='finish' and p_body-array['task_id','fencing_token']::text[]<>'{}'::jsonb) then err:='MALFORMED_CHANNEL_REQUEST';
   else
    if p_action='claim' then perform pg_advisory_xact_lock(17412,1000); end if;
    begin
     -- Filter channel first: never disclose a task's other channel.
     select * into t from public.ai_agent_tasks where id=(p_body->>'task_id')::uuid and channel_id=p_channel for update;
    exception when invalid_text_representation then err:='MALFORMED_CHANNEL_REQUEST'; end;
    now_at:=clock_timestamp();
    if err is null then
     if t.id is null then err:='TASK_NOT_IN_CHANNEL';
     elsif m.member_kind='worker' and t.channel_assigned_to is distinct from p_principal then err:='TASK_NOT_ASSIGNED';
     elsif p_action='status' then
      return jsonb_build_object('ok',true,'channel_id',p_channel,'task_id',t.id,'status',t.status,
       'model_status',case when t.status='blocked' then 'BLOCKED_NO_MODEL' else null end,
       'expires_at',t.expires_at,'expired',t.expires_at<=now_at);
     elsif p_action='finish' and t.channel_claimed_by is distinct from p_principal then err:='CLAIM_OWNER_MISMATCH';
     elsif p_action='claim' and ((select count(*) from public.ai_agent_leases l join public.ai_agent_tasks q on q.id=l.task_id
        where q.channel_id=p_channel and q.id<>t.id and q.status='leased' and l.expires_at>now_at)>=c.max_running
       or (select count(*) from public.ai_agent_leases l join public.ai_agent_tasks q on q.id=l.task_id
        where q.id<>t.id and q.status='leased' and l.expires_at>now_at)>=8) then err:='RUNNER_CAPACITY';
     else
      previous_scope:=current_setting('aivault.channel_scope',true);
      perform set_config('aivault.channel_scope',p_channel,true);
      r:=public.aivault_bridge(p_action,'runner-dry-run',p_body);
      perform set_config('aivault.channel_scope',coalesce(previous_scope,''),true);
      if r->>'ok'='true' then
       if p_action='claim' then
        update public.ai_agent_tasks set channel_claimed_by=p_principal where id=t.id;
        update public.ai_agent_runs set evidence=evidence||jsonb_build_object('channel_id',p_channel,'principal_id',p_principal)
         where id=(r->>'run_id')::uuid;
       end if;
       insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'channel.'||p_action,
        jsonb_build_object('channel_id',p_channel,'principal_id',p_principal,'fencing_token',r->>'fencing_token'));
       return r||jsonb_build_object('channel_id',p_channel);
      else return r; end if;
     end if;
    end if;
   end if;
  else err:='CHANNEL_ACTION_DENIED'; end if;
 end if;
 insert into public.ai_agent_events(event_type,detail) values('channel.rejected',jsonb_build_object('reason',err));
 return jsonb_build_object('ok',false,'error',err);
end $$;
revoke all on function public.aivault_channel(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aivault_channel(text,text,text,jsonb) to service_role;
insert into public.ai_agent_events(event_type,detail) values('channel.registry_provisioned',
 '{"channels":1000,"mode":"dry_run","network_connected":false,"queue":"ai_agent_tasks","global_pending_cap":128,"global_running_cap":8}'::jsonb);
