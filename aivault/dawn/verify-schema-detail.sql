-- Read-only detailed inventory. Target project: svtkpdmqemidlasowqew.
-- Based on Grok's verify-schema-detail.sql; includes identity/generated/check/FK details.
-- No row contents or credentials are selected.
BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'columns', (SELECT json_agg(x ORDER BY x.table_name,x.ordinal_position)
   FROM (SELECT c.table_name,c.ordinal_position,c.column_name,c.data_type,c.udt_name,
     c.is_nullable,c.column_default,c.is_identity,c.identity_generation,
     c.is_generated,c.generation_expression,c.character_maximum_length,
     c.numeric_precision,c.numeric_scale,c.collation_name
     FROM information_schema.columns c WHERE c.table_schema='public') x),
 'indexes', (SELECT json_agg(x ORDER BY x.table_name,x.index_name)
   FROM (SELECT t.relname AS table_name,i.relname AS index_name,
     pg_get_indexdef(i.oid) AS definition,ix.indisvalid,ix.indisready
     FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
     JOIN pg_class t ON t.oid=ix.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='public') x),
 'constraints', (SELECT json_agg(x ORDER BY x.table_name,x.constraint_name)
   FROM (SELECT t.relname AS table_name,k.conname AS constraint_name,k.contype,
     pg_get_constraintdef(k.oid,true) AS definition,k.convalidated,
     k.condeferrable,k.condeferred
     FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid
     JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public') x)
) AS schema_details;
COMMIT;
