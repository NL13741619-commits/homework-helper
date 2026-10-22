# AIVAULT backend inventory — 2026-10-22

Target: Supabase `svtkpdmqemidlasowqew` only.

## Safety boundary

This inventory and migration did **not** touch:
- `NL13741619-commits/safe-reunion-login`
- `NL13741619-commits/safe-reunion`
- Supabase `perfsipperncvjocznhl`

## Restore observation

The second-base project was restored from INACTIVE. During recovery, PostgreSQL restarted and replayed archived WAL. An early control-plane migration was therefore not treated as durable. After the restore completed and the database became reachable again, the AIVAULT control-plane migration was applied again and verified.

## Existing second-base data discovered after restore

The restored database contains **30 pre-existing public tables** from the former homework/legal/AI system. They include:
- `homeworks`
- `teacher_profiles`, `teacher_courses`
- course tables
- AI knowledge / philosophy / strategy / document tables
- ROC Constitution / Constitutional Court / judicial interpretation tables
- legal source/document tables

These old tables were **not deleted**.

Confirmed legacy row counts include:
- `homeworks`: 18
- `law_documents`: 143
- `legal_official_sources`: 1
- `roc_tw_constitution`: 175
- `roc_tw_constitutional_court_documents`: 3
- `roc_tw_constitutional_court_document_sections`: 62
- `ai_constitution_articles`: 11
- `ai_constitution_documents`: 2
- teacher/course tables checked: 0 rows
- several generic AI knowledge/document tables checked: 0 rows

Existing public security state observed:
- all 30 old public tables have RLS enabled
- 39 existing public RLS policies
- one public function, not SECURITY DEFINER
- one public trigger
- existing Edge Functions remain preserved: `bright-service`, `constitution-import`, `fetch-roc-tw-constitutional-court`

## AIVAULT control plane created

Five new private control-plane tables now exist:
- `ai_agent_tasks`
- `ai_agent_runs`
- `ai_agent_events`
- `ai_agent_leases`
- `ai_model_usage`

Controls verified:
- RLS enabled on all five tables
- no `anon` or `authenticated` table grants on these five tables
- no public RLS policies expose these tables
- `command_id` is unique for replay/idempotency defense
- lease fencing token is unique
- model usage enforces `estimated_cost_usd = 0`
- task/run foreign keys and status checks are present
- task and run tables are empty immediately after creation

## Current gate

Do not delete the 30 restored legacy tables yet. First classify them into:
1. reusable AIVAULT knowledge/legal data,
2. obsolete homework/course data,
3. data requiring export/archive before removal.

No production deployment, auto merge, paid API, or Safe Reunion mutation is authorized by this work.