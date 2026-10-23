-- Small private support-AI files only. Source and large assets remain external.
-- This is artifact storage, not another task queue or executable model registry.
create table public.ai_agent_artifacts (
 id bigint generated always as identity primary key,
 task_id uuid not null references public.ai_agent_tasks(id),
 channel_id text not null references public.ai_agent_channels(id),
 principal_id text not null,
 path text not null check(path ~ '^(src|config|prompts|tests|evidence)/[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$'),
 content text not null check(octet_length(content)<=65536),
 content_sha256 text not null check(content_sha256=encode(sha256(convert_to(content,'UTF8')),'hex')),
 created_at timestamptz not null default now()
);
create index ai_agent_artifact_lookup on public.ai_agent_artifacts(task_id,id);
alter table public.ai_agent_artifacts enable row level security;
revoke all on public.ai_agent_artifacts from public,anon,authenticated;
grant select,insert on public.ai_agent_artifacts to service_role;
revoke update,delete,truncate on public.ai_agent_artifacts from service_role;

create function public.aivault_collaboration(p_action text,p_principal text,p_channel text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
set statement_timeout='3s' set lock_timeout='1s' as $$
declare
 c public.ai_agent_channels%rowtype;
 m public.ai_agent_channel_members%rowtype;
 worker public.ai_agent_channel_members%rowtype;
 t public.ai_agent_tasks%rowtype;
 l public.ai_agent_leases%rowtype;
 a public.ai_agent_artifacts%rowtype;
 err text;
 now_at timestamptz;
 items jsonb;
begin
 if p_principal is null or p_principal !~ '^[A-Za-z0-9_-]{3,128}$'
  or p_channel is null or p_channel !~ '^ch-[0-9]{4}$'
  or p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>131072 then err:='MALFORMED_COLLABORATION_REQUEST';
 else
  select * into c from public.ai_agent_channels where id=p_channel;
  select * into m from public.ai_agent_channel_members where channel_id=p_channel and principal_id=p_principal;
  now_at:=clock_timestamp();
  if c.id is null or not c.enabled then err:='CHANNEL_DISABLED_OR_UNKNOWN';
  elsif m.principal_id is null or not m.enabled or (m.expires_at is not null and m.expires_at<=now_at)
   or p_action is null or not(p_action=any(m.actions)) then err:='CHANNEL_ACCESS_DENIED';
  elsif p_action='inbox' then
   if p_body<>'{}'::jsonb then err:='MALFORMED_COLLABORATION_REQUEST';
   else
    select coalesce(jsonb_agg(x),'[]'::jsonb) into items from (
     select id,status,channel_assigned_to,expires_at from public.ai_agent_tasks
     where channel_id=p_channel and status in ('queued','leased') and expires_at>now_at
      and (m.member_kind<>'worker' or channel_assigned_to=p_principal)
     order by created_at,id limit 20
    ) x;
    return jsonb_build_object('ok',true,'channel_id',p_channel,'tasks',items);
   end if;
  elsif p_action in ('dispatch','artifact_read','artifact_write') then
   if coalesce(p_body->>'task_id','') !~ '^[0-9a-f-]{36}$'
     or (p_action='dispatch' and ((select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['assignee','task_id']::text[]))
     or (p_action='artifact_read' and ((select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['artifact_id','task_id']::text[]))
     or (p_action='artifact_write' and ((select array_agg(key order by key) from jsonb_object_keys(p_body) key) is distinct from array['content','fencing_token','path','task_id']::text[])) then err:='MALFORMED_COLLABORATION_REQUEST';
   else
    if p_action='artifact_write' then perform pg_advisory_xact_lock(17412,1000); end if;
    begin
     select * into t from public.ai_agent_tasks where id=(p_body->>'task_id')::uuid and channel_id=p_channel for update;
    exception when invalid_text_representation then err:='MALFORMED_COLLABORATION_REQUEST'; end;
    now_at:=clock_timestamp();
    if err is null then
     if t.id is null then err:='TASK_NOT_IN_CHANNEL';
     elsif m.member_kind='worker' and t.channel_assigned_to is distinct from p_principal then err:='TASK_NOT_ASSIGNED';
     elsif p_action='dispatch' then
      select * into worker from public.ai_agent_channel_members where channel_id=p_channel and principal_id=p_body->>'assignee';
      if m.member_kind<>'controller' or t.status<>'queued' or t.expires_at<=now_at or t.expires_at is null
       or worker.principal_id is null or worker.member_kind<>'worker' or not worker.enabled
       or not('claim'=any(worker.actions)) or (worker.expires_at is not null and worker.expires_at<=now_at) then err:='DISPATCH_DENIED';
      else
       update public.ai_agent_tasks set channel_assigned_to=worker.principal_id,updated_at=now_at where id=t.id;
       insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'channel.dispatched',jsonb_build_object('channel_id',p_channel,'controller',p_principal,'assignee',worker.principal_id));
       return jsonb_build_object('ok',true,'task_id',t.id,'assigned_to',worker.principal_id);
      end if;
     elsif p_action='artifact_read' then
      if coalesce(p_body->>'artifact_id','') !~ '^[0-9]{1,18}$' then err:='MALFORMED_COLLABORATION_REQUEST';
      else
       select * into a from public.ai_agent_artifacts where task_id=t.id and id=(p_body->>'artifact_id')::bigint;
       if a.id is null then err:='ARTIFACT_NOT_FOUND';
       else
        insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'artifact.read',jsonb_build_object('channel_id',p_channel,'principal_id',p_principal,'artifact_id',a.id::text));
        return jsonb_build_object('ok',true,'artifact_id',a.id::text,'path',a.path,'content',a.content,'sha256',a.content_sha256);
       end if;
      end if;
     else
      select * into l from public.ai_agent_leases where task_id=t.id;
      if jsonb_typeof(p_body->'content') is distinct from 'string' or jsonb_typeof(p_body->'path') is distinct from 'string'
       or coalesce(p_body->>'path','') !~ '^(src|config|prompts|tests|evidence)/[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$'
       or octet_length(p_body->>'content')>65536 then err:='ARTIFACT_PATH_OR_SIZE_DENIED';
      elsif t.expires_at is null or t.expires_at<=now_at then err:='TASK_EXPIRED';
      elsif not ((t.status='queued' and m.member_kind in ('controller','bridge'))
        or (t.status='leased' and t.channel_claimed_by=p_principal and l.task_id is not null and l.expires_at>now_at
            and l.fencing_token::text=p_body->>'fencing_token')) then err:='ARTIFACT_WRITE_LEASE_DENIED';
      elsif (select coalesce(sum(octet_length(content)),0) from public.ai_agent_artifacts where task_id=t.id)+octet_length(p_body->>'content')>1048576
        or (select coalesce(sum(octet_length(content)),0) from public.ai_agent_artifacts where channel_id=p_channel)+octet_length(p_body->>'content')>4194304
        or (select coalesce(sum(octet_length(content)),0) from public.ai_agent_artifacts)+octet_length(p_body->>'content')>16777216 then err:='ARTIFACT_QUOTA';
      else
       insert into public.ai_agent_artifacts(task_id,channel_id,principal_id,path,content,content_sha256)
        values(t.id,p_channel,p_principal,p_body->>'path',p_body->>'content',encode(sha256(convert_to(p_body->>'content','UTF8')),'hex')) returning * into a;
       insert into public.ai_agent_events(task_id,event_type,detail) values(t.id,'artifact.written',jsonb_build_object('channel_id',p_channel,'principal_id',p_principal,'artifact_id',a.id::text,'sha256',a.content_sha256));
       return jsonb_build_object('ok',true,'artifact_id',a.id::text,'sha256',a.content_sha256);
      end if;
     end if;
    end if;
   end if;
  else err:='COLLABORATION_ACTION_DENIED'; end if;
 end if;
 insert into public.ai_agent_events(event_type,detail) values('collaboration.rejected',jsonb_build_object('reason',err));
 return jsonb_build_object('ok',false,'error',err);
end $$;
revoke all on function public.aivault_collaboration(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aivault_collaboration(text,text,text,jsonb) to service_role;
