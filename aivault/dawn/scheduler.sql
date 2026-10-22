-- User explicitly authorized deployment. Bounded persistent trigger, not a
-- permanently resident Linux process. 144 scheduled calls/day, no model by default.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
do $$ declare token text;begin
 if not exists(select 1 from vault.secrets where name='aivault_dawn_scheduler_v1') then
  token:=encode(extensions.gen_random_bytes(48),'hex');
  perform vault.create_secret(token,'aivault_dawn_scheduler_v1','Private base-002 Dawn schedule credential; never export');
 else select decrypted_secret into token from vault.decrypted_secrets where name='aivault_dawn_scheduler_v1';end if;
 insert into public.ai_agent_runtime_principals(principal_id,token_sha256,principal_kind)
  values('dawn-scheduler',encode(sha256(convert_to(token,'UTF8')),'hex'),'scheduler')
  on conflict(principal_id) do nothing;
end $$;
select cron.schedule('aivault-dawn-bounded-tick','*/10 * * * *',
 $job$select net.http_post(
  url:='https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-dawn-runtime',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='aivault_dawn_scheduler_v1')),
  body:='{"action":"run_once"}'::jsonb,timeout_milliseconds:=50000
 ) where (select enabled from public.ai_agent_runtime_config where instance_id='base-002:dawn-light');$job$);
