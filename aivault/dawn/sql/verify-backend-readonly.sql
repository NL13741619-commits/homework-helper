-- Dawn backend verification only. Target: svtkpdmqemidlasowqew.
-- No schema changes, token creation, task execution, or external model calls.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,
       current_setting('transaction_read_only') AS read_only;
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname;
COMMIT;
