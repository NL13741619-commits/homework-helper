# 曙光憑證、心跳與新增任務交接

Implemented deployment v6 reads DAWN_CROSSBASE_GITHUB_TOKEN first, with legacy
AIVAULT_GITHUB_TOKEN as a compatibility alias. Private preflight actually reads
the credential, verifies immutable user305579832, probes both fixed repositories
and local Issue1, and reports read/push separately. It never returns the token.
No write/push is performed by preflight. Current actual result: configured=false.

The missing credential cannot be minted from the ChatGPT connector or borrowed
from main city. Only the NL13741619-commits account holder/authorized administrator
can create and inject its independent credential. All code needed to consume it
is deployed; the remaining account action is concrete:

1. Sign into GitHub as NL13741619-commits. Open
   https://github.com/settings/tokens/new and create an expiring token named
   dawn-crossbase. For the current cross-owner public-repository integration,
   classic public_repo is the relevant public scope. Do not enable private repo,
   workflow, administration, deletion or billing scopes for this Issues task.
   Classic public_repo is broader than a single repository; token scope does not
   create collaborator/push rights. A narrower GitHub App would require a separate
   reviewed bot-identity adapter; this runtime currently verifies the user ID.
2. Open the second-base secrets page:
   https://supabase.com/dashboard/project/svtkpdmqemidlasowqew/functions/secrets .
   Add key DAWN_CROSSBASE_GITHUB_TOKEN and enter the new token only in its Value
   field, then Save. Do not post it to chat, Issues, frontend files or first-base
   secrets. Existing model keys are not reset.
3. The private preflight and next scheduled tick can then verify identity/read
   scope and deliver a persisted, uniquely marked outbox item. Only a confirmed
   returned comment ID proves delivery. No delivery is claimed before that check.

References verified2026-10-23:
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
https://docs.github.com/en/rest/issues/comments
https://supabase.com/docs/guides/functions/secrets

Current cloud preflight also confirms the existing Gemini key is present, but
Qwen remote credential/endpoint and model policy are not configured. The successful
local Qwen test does not change that state. No private memory was sent to a remote
model; explicit context-transfer permission remains required in private policy.

## Backend heartbeat evidence

last_tick_at is written only by the real authenticated Edge tick after the DB
principal/config checks, never directly by a SQL timestamp-refresh schedule.
Private status now computes BACKEND_ALIVE/STALE/UNKNOWN/CLOCK_SKEW/DISABLED; stale
threshold900s matches a ten-minute tick. It explicitly does not certify model or
worker availability. Fresh/stopped-time expiry interpretation is unit tested;
production was not deliberately stopped for a live outage drill.

Observed53 successful scheduled enqueues from2026-10-23 00:20 through09:00 Taipei,
zero failed enqueues. The37 retained HTTP responses were all200 with no timeout.
The actual private status check returned BACKEND_ALIVE, age368s. This is over
eight hours of observed backend operation, not a completed24h soak or permanent
Qwen process. Evidence: dawn-credential-heartbeat-preflight-2026-10-23.json.

## New work registered in the existing task table

The engineering controller verified source immutable author306819786, merged
related comments into four work batches and registered them in ai_agent_tasks.
No new queue,32,000 workers, fake heartbeat or revenue records were created.

| Batch | Existing-queue task | Current engineering result |
| --- | --- | --- |
| DAWN-CREDENTIAL-CONNECT-001 | be46924d-c129-4262-98dd-38024243907a | Secret alias/preflight deployed; token absent. Invitation338820845 ACCEPTED per verified primary report6353575369; not independently rechecked here, no duplicate invite |
| OFFLINE-COMIC-PRODUCTION-001 | c9c78161-94ae-4cef-a060-6afc8e44bb72 | Production/curriculum requests retained; no verified media executor/sample/revenue |
| AIVAULT-DAWN-MODEL-PORTAL-RD-001 | 09ff6bc7-b10d-444d-b04b-25c590ba7c63 | Registered; video/digital-human model selection and short clip pending. Remote portal source added independently in d554ad620120d4c3cc2f37d199475d465bbdccd7; live deployment/UI acceptance not independently verified here |
| DAWN-BACKEND-HEARTBEAT-001 | 1b2502ec-8283-496c-83e6-b94ab3b753d6 | Authenticated scheduled backend ticks and stale classification verified; not model/worker online |

Source comments and original batch IDs are retained in the task questions and
docs/evidence/dawn-new-task-register-2026-10-23.json. Registration was performed by
the engineering controller, not falsely attributed to a model or worker.

The earlier symmetric-task2629a579-3c8c-40c3-8d23-333bade69eae was actually claimed
by deployed Dawn runtime (fence29/run8d3e724d-8c72-4421-8073-acb8150ba86f), read
private memory and committed BLOCKED_NO_MODEL. HTTP request42 returned200; its
help request is durable but outbound delivery lacks the credential above.

Several primary instructions lack explicit recipient_agent or a machine envelope;
the current strict receiver preserves these as review-only/ignored, not silently
executed. Engineering review/intake is separately labeled. Future automatic
commands should use the existing AIVAULT-MESSAGE-V1 envelope with explicit
base-001→base-002, recipient_agent=dawn-light, kind=instruction, timestamp, unique
message_id and the registered main-city reply inbox. Automated status replies
must remain receipts/results so they cannot create work loops.
