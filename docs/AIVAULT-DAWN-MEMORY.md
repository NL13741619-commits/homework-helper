# 曙光個人記憶：500000字元

Implemented on base-002 project svtkpdmqemidlasowqew after actual schema inspection.
Instance base-002:dawn-light is the only allowed namespace. This is a PostgreSQL
persistent store, not an LLM context window, trained weights or running agent.

## Capacity and retrieval

- Total content capacity: 500000 Unicode characters using PostgreSQL char_length,
  not bytes, tokens or JavaScript UTF-16 code units. Combining sequences count as
  separate code points; an emoji may have multiple code points. Titles/provenance
  and database/index/audit overhead are separately bounded, outside content quota.
- Each entry: 1–10000 content characters; title ≤120; source_ref ≤256; max1000
  entries. Capacity covers all retained content. Full store rejects new writes;
  no automatic deletion or overwrite. Administrative retention/export requires a
  separately reviewed operation; no destructive maintenance API was added.
- Recall uses literal substring search (no paid embedding API), max8 excerpts of
  1000 characters. Read retrieves a requested entry slice of ≤4000 characters.
  Offset is zero-based in Unicode characters. No automatic 500000-character prompt.
- Durable append stores source_ref, principal, timestamp, SHA256, optional existing
  task/fencing identifiers and a unique idempotency key. Same request returns its
  original entry; changed reuse is rejected. Existing ai_agent_events records
  reads/writes/rejections without copying raw memory into audit events.

## Isolation and authority

New tables: ai_agent_memory_spaces, ai_agent_memory_members,
ai_agent_memory_entries. Existing task queue and legacy records remain unchanged.
RLS is enabled with no anon/authenticated policy and table/function privileges
revoked for both. Service-role has no entry update/delete/truncate or ACL write
grant. Access runs through aivault_memory SECURITY INVOKER with fixed search_path.

The trusted server is the security boundary: it resolves principal from an
independently authenticated credential, never a payload, and invokes the RPC with
its private service credential. As with the existing control-plane architecture,
a service-role credential is privileged and must not be given to a browser or
autonomous agent; direct service SQL is trusted administration, not a public API.
RLS does not isolate callers who share a stolen service-role key.

Initially only base2-controller is authorized to seed/read reviewed records.
Dawn's autonomous worker membership is deliberately not invented; host onboarding
must map its real revocable principal and scoped channel grant. Worker appends
require a current task owner, live task/lease, matching fence and artifact_write
channel capability. Row locks hold the task/lease through the write. Controller
seeding is explicitly distinguished from autonomous task output. Readers cannot
write. Disabling the space or membership blocks subsequent calls.

Capacity trigger locks the memory-space row and sums stored content before every
insert, including trusted direct inserts; it touches that row to make competing
repeatable-read transactions serialize/retry. No process-local quota counter.
Lock timeout and statement timeout bound RPC work. Concurrent-host load tests
have not been performed; isolation reasoning is not a concurrency benchmark.

## Actual evidence, 2026-10-22 UTC

Applied additive migrations aivault_dawn_private_memory_500k and
aivault_dawn_memory_lock_privilege_fix. The latter removed an unnecessary channel
row lock that service_role correctly lacked permission to acquire; no existing
channel privileges were expanded. Repository memory.sql contains final behavior.

Live database test, executed as service_role inside rollback: nine grouped
assertion checks plus two administrative revocation/kill-switch checks passed.
Includes Unicode slice, read/write separation, duplicate/conflict, malformed
payload, wrong base/principal, real existing dry-run claim and fenced append,
stale/finished lease refusal, entry immutability, exact500000 capacity and overflow
rejection through both RPC and direct insert. All test records and tasks rolled
back. This is database/control testing, not inference or automatic code execution.

Three reviewed bootstrap memories were then actually stored by the engineering
controller, entry IDs56/57/58, lengths227/253/202: identity, safety rules and dated
runtime status. Used682 / remaining499318 characters. No primary personal memory,
secret or private user history was copied. Legacy counts remain18/143/175.

Post-change advisors show only the three expected RLS-with-no-policy INFO additions
for this private service-only store. Existing unrelated warnings remain unchanged
(legacy mutable search_path and Auth leaked-password setting); no out-of-scope
legacy/auth modification was made. Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Host integration still required

memory.mjs pins instance and server principal, bounds recall and marks all recalled
content untrusted. It is a private adapter with injected RPC, not a new public
endpoint. The model gateway has not been wired to automatically recall memories;
the future host must call it under authenticated scope and supply retrieved data
as reference content, never as replacement system instructions. Memory cannot
grant tools, credentials, model billing permission or deployment authority.

Private memory exists now; live autonomous reading/writing and continuous service
remain blocked by independent host identity, runner, approved free model and
runtime integration. These conditions are being discussed directly with main city
under DAWN-HOST/IDENTITY/STORAGE/MODEL/LOOP-001.
