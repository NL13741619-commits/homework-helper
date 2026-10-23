-- Additive second-base private memory, NOT another task queue.
create table public.ai_agent_memory_spaces (
 instance_id text primary key check(instance_id='base-002:dawn-light'),
 capacity_chars integer not null default 500000 check(capacity_chars=500000),
 enabled boolean not null default true,
 lock_sentinel integer not null default 0 check(lock_sentinel=0),
 created_at timestamptz not null default now()
);
create table public.ai_agent_memory_members (
 instance_id text not null references public.ai_agent_memory_spaces,
 principal_id text not null check(principal_id ~ '^[A-Za-z0-9_-]{3,128}$'),
 member_kind text not null check(member_kind in ('controller','worker','reader')),
 can_read boolean not null default false,
 can_write boolean not null default false,
 enabled boolean not null default true,
 expires_at timestamptz,
 primary key(instance_id,principal_id)
);
create table public.ai_agent_memory_entries (
 id bigint generated always as identity primary key,
 instance_id text not null references public.ai_agent_memory_spaces,
 principal_id text not null,
 idempotency_key text not null check(idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 title text not null check(char_length(title) between 1 and 120),
 content text not null check(char_length(content) between 1 and 10000),
 source_ref text not null check(char_length(source_ref) between 1 and 256),
 content_chars integer generated always as (char_length(content)) stored,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 task_id uuid references public.ai_agent_tasks,
 fencing_token bigint,
 created_at timestamptz not null default now(),
 unique(instance_id,idempotency_key)
);
alter table public.ai_agent_memory_spaces enable row level security;
alter table public.ai_agent_memory_members enable row level security;
alter table public.ai_agent_memory_entries enable row level security;
revoke all on public.ai_agent_memory_spaces,public.ai_agent_memory_members,public.ai_agent_memory_entries from public,anon,authenticated,service_role;
grant select on public.ai_agent_memory_spaces,public.ai_agent_memory_members,public.ai_agent_memory_entries to service_role;
grant insert on public.ai_agent_memory_entries to service_role;
-- SELECT FOR UPDATE needs an update privilege; this column cannot change value.
grant update(lock_sentinel) on public.ai_agent_memory_spaces to service_role;
grant usage,select on sequence public.ai_agent_memory_entries_id_seq to service_role;
insert into public.ai_agent_memory_spaces(instance_id) values('base-002:dawn-light');
-- Engineering controller can seed reviewed records. No autonomous role identity
-- is invented; provision Dawn's revocable worker membership after host onboarding.
insert into public.ai_agent_memory_members(instance_id,principal_id,member_kind,can_read,can_write)
 values('base-002:dawn-light','base2-controller','controller',true,true);

create function public.aivault_memory_capacity_guard()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cap integer; used bigint; entries bigint;
begin
 select capacity_chars into cap from public.ai_agent_memory_spaces
  where instance_id=new.instance_id and enabled for update;
 if cap is null then raise exception 'MEMORY_DISABLED' using errcode='23514'; end if;
 select coalesce(sum(content_chars),0),count(*) into used,entries
  from public.ai_agent_memory_entries where instance_id=new.instance_id;
 if used+char_length(new.content)>cap or entries>=1000 then
  raise exception 'MEMORY_CAPACITY_EXCEEDED' using errcode='23514';
 end if;
 -- Touch the lock row so repeatable-read writers also detect a competing write
 -- and serialize/retry rather than using an old aggregate snapshot.
 update public.ai_agent_memory_spaces set lock_sentinel=0 where instance_id=new.instance_id;
 new.content_sha256:=encode(sha256(convert_to(new.content,'UTF8')),'hex');
 return new;
end $$;
revoke all on function public.aivault_memory_capacity_guard() from public,anon,authenticated;
grant execute on function public.aivault_memory_capacity_guard() to service_role;
create trigger aivault_memory_capacity before insert on public.ai_agent_memory_entries
 for each row execute function public.aivault_memory_capacity_guard();

-- Trusted server derives p_principal from a verified credential, never payload.
-- No public frontend or autonomous runner receives a service_role key.
create or replace function public.aivault_memory(p_action text,p_principal text,p_instance text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
set statement_timeout='3s' set lock_timeout='1s' as $$
declare
 m public.ai_agent_memory_members%rowtype;
 e public.ai_agent_memory_entries%rowtype;
 t public.ai_agent_tasks%rowtype;
 l public.ai_agent_leases%rowtype;
 err text; total bigint; n integer; off integer; rows jsonb;
 task uuid; fence bigint;
begin
 select * into m from public.ai_agent_memory_members where instance_id=p_instance
  and principal_id=p_principal and enabled and (expires_at is null or expires_at>clock_timestamp());
 if m.principal_id is null or not exists(select 1 from public.ai_agent_memory_spaces where instance_id=p_instance and enabled) then err:='MEMORY_ACCESS_DENIED';
 elsif p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>65536 then err:='MALFORMED_MEMORY_REQUEST';
 elsif p_action='append' and m.can_write and m.member_kind in ('controller','worker') then
  if p_body-array['title','content','source_ref','idempotency_key','task_id','fencing_token']::text[]<>'{}'::jsonb
   or jsonb_typeof(p_body->'title') is distinct from 'string' or char_length(p_body->>'title') not between 1 and 120
   or jsonb_typeof(p_body->'content') is distinct from 'string' or char_length(p_body->>'content') not between 1 and 10000
   or jsonb_typeof(p_body->'source_ref') is distinct from 'string' or char_length(p_body->>'source_ref') not between 1 and 256
   or jsonb_typeof(p_body->'idempotency_key') is distinct from 'string' or p_body->>'idempotency_key' !~ '^[A-Za-z0-9_-]{8,128}$'
   then err:='MALFORMED_MEMORY_REQUEST';
  else
   -- Same row-lock order as claim/finish: task -> lease -> memory space.
   if m.member_kind='worker' then
    if coalesce(p_body->>'task_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p_body->>'fencing_token','') !~ '^[0-9]{1,18}$' then err:='MEMORY_LEASE_DENIED';
    else
     task:=(p_body->>'task_id')::uuid; fence:=(p_body->>'fencing_token')::bigint;
     select * into t from public.ai_agent_tasks where id=task for update;
     select * into l from public.ai_agent_leases where task_id=task for update;
     if t.status is distinct from 'leased' or t.expires_at is null or t.expires_at<=clock_timestamp()
       or t.channel_claimed_by is distinct from p_principal or l.fencing_token is distinct from fence
       or l.expires_at is null or l.expires_at<=clock_timestamp()
       or not exists(select 1 from public.ai_agent_channels c join public.ai_agent_channel_members cm on cm.channel_id=c.id
         where c.id=t.channel_id and c.enabled and cm.principal_id=p_principal and cm.enabled
         and cm.member_kind='worker' and 'artifact_write'=any(cm.actions) and (cm.expires_at is null or cm.expires_at>clock_timestamp()))
       then err:='MEMORY_LEASE_DENIED'; end if;
    end if;
   elsif p_body ?| array['task_id','fencing_token'] then err:='MALFORMED_MEMORY_REQUEST'; end if;
   if err is null then
    perform 1 from public.ai_agent_memory_spaces where instance_id=p_instance and enabled for update;
    select * into e from public.ai_agent_memory_entries where instance_id=p_instance and idempotency_key=p_body->>'idempotency_key';
    if e.id is not null then
     if e.principal_id=p_principal and e.content=p_body->>'content' and e.title=p_body->>'title'
      and e.source_ref=p_body->>'source_ref' and e.task_id is not distinct from task and e.fencing_token is not distinct from fence then
      return jsonb_build_object('ok',true,'duplicate',true,'entry_id',e.id::text,'content_chars',e.content_chars);
     else err:='MEMORY_IDEMPOTENCY_CONFLICT'; end if;
    else
     begin
      insert into public.ai_agent_memory_entries(instance_id,principal_id,idempotency_key,title,content,source_ref,task_id,fencing_token)
       values(p_instance,p_principal,p_body->>'idempotency_key',p_body->>'title',p_body->>'content',p_body->>'source_ref',task,fence) returning * into e;
      insert into public.ai_agent_events(task_id,event_type,detail) values(task,'dawn.memory_appended',
       jsonb_build_object('instance_id',p_instance,'principal_id',p_principal,'entry_id',e.id::text,'content_chars',e.content_chars,'sha256',e.content_sha256));
      return jsonb_build_object('ok',true,'entry_id',e.id::text,'content_chars',e.content_chars,'sha256',e.content_sha256);
     exception when check_violation then err:='MEMORY_CAPACITY_OR_CONSTRAINT'; end;
    end if;
   end if;
  end if;
 elsif p_action='status' and m.can_read and p_body='{}'::jsonb then
  select coalesce(sum(content_chars),0),count(*) into total,n from public.ai_agent_memory_entries where instance_id=p_instance;
  return jsonb_build_object('ok',true,'instance_id',p_instance,'capacity_chars',500000,'used_chars',total,'remaining_chars',500000-total,'entries',n);
 elsif p_action='read' and m.can_read then
  if (select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['entry_id','limit','offset']::text[]
    or coalesce(p_body->>'entry_id','') !~ '^[0-9]{1,18}$' or coalesce(p_body->>'offset','') !~ '^[0-9]{1,5}$'
    or coalesce(p_body->>'limit','') !~ '^[0-9]{1,4}$' then err:='MALFORMED_MEMORY_REQUEST';
  else
   n:=(p_body->>'limit')::integer;off:=(p_body->>'offset')::integer;
   if n not between 1 and 4000 or off>10000 then err:='MALFORMED_MEMORY_REQUEST';
   else
    select * into e from public.ai_agent_memory_entries where instance_id=p_instance and id=(p_body->>'entry_id')::bigint;
    if e.id is null then err:='MEMORY_NOT_FOUND';
    else
     insert into public.ai_agent_events(event_type,detail) values('dawn.memory_read',jsonb_build_object('instance_id',p_instance,'principal_id',p_principal,'entry_id',e.id::text,'offset',off,'limit',n));
     return jsonb_build_object('ok',true,'entry_id',e.id::text,'title',e.title,'content',substr(e.content,off+1,n),'offset',off,'total_chars',e.content_chars,'source_ref',e.source_ref,'sha256',e.content_sha256);
    end if;
   end if;
  end if;
 elsif p_action='recall' and m.can_read then
  if (select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['limit','query']::text[]
    or jsonb_typeof(p_body->'query') is distinct from 'string' or char_length(p_body->>'query')>128
    or coalesce(p_body->>'limit','') !~ '^[1-8]$' then err:='MALFORMED_MEMORY_REQUEST';
  else
   select coalesce(jsonb_agg(x order by x.id::bigint desc),'[]'::jsonb) into rows from
    (select id::text id,title,substr(content,1,1000) content,content_chars total_chars,source_ref,content_sha256 sha256
     from public.ai_agent_memory_entries where instance_id=p_instance and
      (p_body->>'query'='' or strpos(lower(title||' '||content),lower(p_body->>'query'))>0)
     order by ai_agent_memory_entries.id desc limit (p_body->>'limit')::integer) x;
   insert into public.ai_agent_events(event_type,detail) values('dawn.memory_recalled',jsonb_build_object('instance_id',p_instance,'principal_id',p_principal,'entries',jsonb_array_length(rows)));
   return jsonb_build_object('ok',true,'entries',rows,'untrusted_memory',true);
  end if;
 else err:='MEMORY_ACTION_DENIED'; end if;
 insert into public.ai_agent_events(event_type,detail) values('dawn.memory_rejected',jsonb_build_object('reason',err));
 return jsonb_build_object('ok',false,'error',err);
end $$;
revoke all on function public.aivault_memory(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aivault_memory(text,text,text,jsonb) to service_role;
insert into public.ai_agent_events(event_type,detail) values('dawn.memory_provisioned',
 '{"instance_id":"base-002:dawn-light","capacity_chars":500000,"autonomous_identity_provisioned":false,"runtime_connected":false}'::jsonb);
