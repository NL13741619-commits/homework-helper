# AIVAULT Bridge Intake v1 — prototype mapping and review

Scope: `NL13741619-commits/homework-helper`, branch `feature/aivault-rebuild`,
Supabase `svtkpdmqemidlasowqew` only. Reviewed 2026-10-22 (Asia/Taipei).

## Inputs and actual schema inspected

Reviewed all three archive files: `schema.sql`, `bridge-server.mjs`, `README.md`.
Archive SHA-256: `879b89479ccfaadb562e1f60afde25645edd9134fc4fda1737ac9a0618cc61e7`.
Read PostgreSQL catalogs for column types/defaults/nullability, constraints,
identity sequences, RLS, grants, and public functions before implementation.

Existing control columns (before this change):

| Existing table | Columns |
| --- | --- |
| ai_agent_tasks | id uuid, command_id text UNIQUE, source text, repository text, issue_number bigint, requested_by uuid, task_type text, payload jsonb, status text, created_at, updated_at |
| ai_agent_runs | id uuid, task_id uuid FK, runner_id text, status text, branch_name text, commit_sha text, pull_request_number bigint, evidence jsonb, started_at, finished_at |
| ai_agent_events | id bigint GENERATED ALWAYS AS IDENTITY, task_id uuid FK nullable, run_id uuid FK nullable, event_type text, detail jsonb, created_at |
| ai_agent_leases | task_id uuid PK/FK, runner_id text, fencing_token bigint GENERATED ALWAYS AS IDENTITY UNIQUE, acquired_at, expires_at |
| ai_model_usage | id bigint identity, task_id/run_id uuid FK nullable, provider/model text, input_units/output_units bigint, estimated_cost_usd numeric CHECK (=0), created_at |

Task states already allowed: queued, leased, running, blocked, succeeded, failed,
cancelled. Run states: started, blocked, succeeded, failed, cancelled.
These enums, existing foreign keys, and existing fencing identity are reused.
All five tables already had RLS and grants only to postgres/service_role.

## Field and route mapping

| Prototype | Existing AIVAULT destination / decision |
| --- | --- |
| bridge.tasks.id | ai_agent_tasks.id |
| sender | authenticated token → base1; ai_agent_tasks.bridge_sender (new) |
| recipient | validated constant base2; retained in payload envelope |
| task_type/payload | dry_run only; strict envelope in ai_agent_tasks.payload |
| command identity | existing command_id UNIQUE; duplicate rejects without another task |
| replay nonce | bridge_nonce (new), UNIQUE(bridge_sender, bridge_nonce) |
| expiry | expires_at (new); issued_at retained in envelope; finite bounded timestamps |
| status queued/claimed | existing queued/leased; finish → blocked with BLOCKED_NO_MODEL |
| claimed_by/claimed_at | ai_agent_leases.runner_id/acquired_at |
| lease/fencing | existing ai_agent_leases expiry + fresh identity fencing token |
| result/error | ai_agent_runs.evidence and ai_agent_events.detail; no arbitrary submitted result |
| bridge.events | existing ai_agent_events; transactionally coupled to task/run transitions |
| bridge.heartbeats | not imported; v1 uses bounded 30-second leases, reclaim on expiry, no renewal route |
| POST /tasks | POST /commands → aivault_bridge('intake', verified actor, envelope) |
| POST /tasks/:id/claim | POST /claim → atomic row-lock claim and run/lease/event writes |
| complete/fail | POST /finish → matching live lease/fence required; mock evidence only |
| GET tasks / heartbeat | no broad listing or heartbeat endpoint in v1 |

No `bridge.tasks`, `bridge.events`, or `bridge.heartbeats` are created.
No changes to legacy tables, Edge Functions, auth configuration, or secrets.

## Reviewed gaps and remediation

Prototype REST calls did not set its private schema profile and did not append
its declared event records. Its filtered PATCH is insufficient for an expiring
lease with a fresh fencing generation. It also lacks command identity, expiry,
strict payload/target policy, resource bounds and a kill switch.

Intake authenticates distinct private base1/runner credentials with constant-time
comparison; actor comes from that credential, never the submitted sender.
Only the trusted server's service credential can invoke the RPC. The RPC is
SECURITY INVOKER with a fixed search_path; PUBLIC/anon/authenticated EXECUTE
is revoked. RLS and denied browser table grants remain. Service-role UPDATE,
DELETE and TRUNCATE on audit events are revoked; postgres remains administrative.

Unique indexes arbitrate concurrent command/nonce insertion. Task row locks
serialize claim/reclaim/finish. Lease replacement uses the existing identity
sequence, invalidating prior fences. Every finish checks status, owner, expiry
and fence. Task expiry is checked independently. There is no unfenced finish
path, model call, shell, child process, git write, deployment or merge path.
Rejections record reason/action without storing the rejected raw payload.
Database errors roll back task/run/lease/event transitions together.

## Fixed contract and resource limits

Exact payload keys: repository, project_ref, branch, mode, model, tests.
Allowed values are the second-base repository/ref, feature/aivault-rebuild,
mock, none, and `["bridge_contract_v1"]`. Unknown keys and arbitrary commands
are denied. Command age ≤5 minutes, TTL ≤10 minutes, clock skew ≤30 seconds.
Transport body ≤16 KiB; 8 active requests; 16 connections; 60 requests per actor
per minute; 5-second HTTP timeouts; 3-second RPC/statement timeout; 1-second
database lock timeout; lease ≤30 seconds and never beyond task expiry.
Fences are serialized as strings to avoid JavaScript bigint precision loss.

Kill switch: createIntake defaults disabled and checks enabled() on every
request and again immediately before RPC. Host must supply mutable local state;
no remote/payload enable route exists. Disabling stops new requests; already
started database work is bounded by statement timeout. Emergency backend stop:
an authorized operator can revoke service_role EXECUTE on aivault_bridge.
No kill switch or host was enabled/deployed during this work.

Transport failures/auth denial use redacted host audit output; an unverified
caller is never allowed to write through service credentials. Persisting host
audit and global rate limiting across hosts are private-host integration work.

## Validation and present boundary

Fixed local check: `node --test aivault/bridge/test/intake.test.mjs` (3 tests).
Database contract: `aivault/bridge/test/database.sql` (17 named checks with
additional protected-target and fence assertions). First rehearsed with schema
inside BEGIN/ROLLBACK, then applied the additive control migration and retained
synthetic dry-run evidence. The same suite passed as service_role inside a
rollback transaction. Sequence gaps from rehearsal/rollback are expected.

Durable suite event: 49. Mock race task:
`a33c6a3b-0e79-4e41-99ca-469f46d3bd87`. Two concurrently submitted claim calls
returned exactly one success (fence 5) and one LEASE_CONFLICT; event 53 records
the fenced mock finish with BLOCKED_NO_MODEL. Audit snapshot is in
`docs/evidence/bridge-dry-run-2026-10-22.json` (events 26–53).

Legacy counts still homeworks=18, law_documents=143, roc_tw_constitution=175;
model usage rows=0. No protected repository/backend was accessed for testing.

Advisors: no new RPC search-path warning; five control-table no-policy INFOs
are intentional deny-by-default. Existing legacy function search-path and Auth
leaked-password warnings were observed and left outside this scope.

The HTTP transport is tested locally with a mocked RPC, and the actual database
RPC is tested separately, including service-role permissions. No private host,
production endpoint, main-city credential provisioning, persistent polling,
real model inference, isolated code runner or task-generated PR was enabled.
Those are not represented as completed. This round updates the engineering
Draft PR only. Model gate is BLOCKED_NO_MODEL; enabling real execution needs
the separately authorized model/runner phase.

Supabase reference checked: https://supabase.com/docs/guides/database/functions
and https://supabase.com/changelog.md. Uses Node built-ins, no new dependencies.
