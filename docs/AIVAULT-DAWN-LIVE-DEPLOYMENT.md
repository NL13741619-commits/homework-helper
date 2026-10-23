# 曙光實際部署與 Qwen 驗收（2026-10-23 台北）

The founder explicitly authorized deployment in this conversation. The new live
service is aivault-dawn-runtime on project svtkpdmqemidlasowqew. It does not replace
the old homework functions or modify Safe Reunion. The earlier standalone
aivault-dawn-text client contract/UI is not this endpoint and remains unintegrated.

## Deployed service

Endpoint: https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-dawn-runtime

Private API, not a public website/login page. Unauthenticated requests return401.
The function performs its own SHA256-backed credential authentication, which is
why platform verify_jwt=false is intentional; it is not anonymous access.
Revocable principals/expiry live in ai_agent_runtime_principals, accessible only
to the trusted server/admin. No connector OAuth or provider key was copied into
an agent or frontend. Engineering's temporary controller expires after24h.

The durable scheduler uses a separately generated private Vault token, retained
inside the database, with scheduler-only HTTP actions. It can status/run_once;
it cannot submit arbitrary controller tasks or query private task results. Cron
job aivault-dawn-bounded-tick runs */10 * * * * (144 scheduled invocations/day).
Daily authenticated-request cap200, model reservation cap16/day, one task/tick,
90s tick/lease, max3 task attempts,24h task expiry. No idle model invocation.

Config enabled=false stops work and prevents the cron HTTP call. Admin may also
disable the principal or cron job. Do not open browser privileges to control
tables. Existing RLS/no-policy INFO is deliberate; legacy warnings are unchanged.

## Shared queue and fixed execution

ai_agent_tasks remains the sole execution queue. Existing runs, leases/fencing,
events, memory and model-usage tables are reused. Four new tables are supporting
configuration, revocable principal hashes, inbox receipts and a delivery outbox;
neither receipts nor outbox is a second task execution queue.

Claim/reclaim uses row locks and fresh fencing; renew/finish checks lease, owner
and expiry. Completion, evidence, bounded outcome memory and outbound intent are
transactional. Global128 pending/8 live lease admission shares advisory lock
17412,1000 with the channel dispatcher; channel capacity queries were updated to
include unscoped Dawn tasks. No existing channel ACL was expanded.

Allowed tasks are memory_status, literal-text hash_text and policy-gated qa.
No shell, arbitrary URL, code-write, production code deployment or dynamic tests
can be supplied by model/Issue text. This is a working limited runtime, not a
general autonomous code-modification/container runner or ten live workers.

Private POST actions for a controller: status,submit,run_once,result,resume.
Example submission body (authorization comes from the private host credential):

```json
{"action":"submit","kind":"hash_text","question":"AIVAULT","idempotency_key":"unique_command_0001"}
```

run_once with task_id processes that queued task; result reads committed run
evidence. Main/direct repository targets, model selection and arbitrary payload
fields cannot be supplied through submit. Full API credential values are not
published or included in repository files.

## Actual inbox and outbox

The service reads its own base-002 Issue1, checks immutable author306819786,
base-001→base-002, registered reply inbox, explicit recipient_agent=dawn-light,
kind=instruction and24h expiry. Receipts/results/legacy/other-role messages never
become tasks. Source comment/message IDs and hashes are persisted atomically with
accepted tasks; duplicates, replay and edited messages do not create new work.
Inbound raw text is retained as task reference data, not shell or permissions.

One bounded page100 per poll; a full page pauses checkpoint advancement and
reports INBOX_BACKLOG_REQUIRES_DRAIN. This deliberately fails closed rather than
silently skipping messages, but needs an operator drain for a large backlog.
GitHub is read through its public API when no independent token is configured;
rate limits are surfaced. A failed inbox fetch does not prevent queued tool work.

Actual accepted source6343996657 / message base-001-dawn-must-receive-execute-help-v1
became task31a4ff37-f8b1-44a2-a476-3b7534044170. The deployed runner claimed it,
read private memory and committed BLOCKED_NO_MODEL plus a concrete help_request.
This proves receiver/control execution, not model understanding of that message.

Outbox markers are deterministic per task/kind, persist before POST, and retain
confirmed comment IDs. Unknown/sending outcomes reconcile the registered sender
and marker before another send; an unconfirmed result is never blindly retried.
Independent AIVAULT_GITHUB_TOKEN is currently absent, so actual automatic sending
is BLOCKED_NO_GITHUB_CREDENTIAL. The existing engineering connector is not reused
by the runtime. Engineering reports remain separately labeled.

After correcting a blocker, primary can send an authenticated existing-envelope
instruction to local Issue1 with recipient_agent=dawn-light, action=resume_task,
task_id, help_id DAWN-MODEL-001 or DAWN-LOOP-001, unique message_id and timestamp.
The verified reply resumes the existing blocked task once and records a receipt.
It cannot enable a model, alter billing or grant tools. Automatic network resume
has not been exercised with a real primary reply; fixture filtering is tested.

Supplement6353053245 reports primary's own external-model context test was denied
by automatic approval review. That review was not bypassed here. The second-base
remote model adapter additionally requires context_transfer_authorized=true in
the private operator policy before sending recalled memory/task text to any
remote model endpoint. Approval of a model/key alone is insufficient. Default
is false and no external model context has been sent in this delivery. Local
finite Qwen tests used the published role instructions and synthetic task data.

## Actual Qwen installation and inference

Main-city message6345395485 clarified the browser ONNX demonstration was
onnx-community/Qwen3-0.6B-ONNX, not an established6B model or running server.
This delivery actually downloaded the official CPU GGUF model to the authorized
engineering environment, outside git/artifact storage:

- Qwen/Qwen3-0.6B-GGUF revision23749fefcc72300e3a2ad315e1317431b06b590a.
- Qwen3-0.6B-Q8_0.gguf,639446688 bytes, SHA256
  9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031.
- Official llama.cpp CPU release b11669, source620d2225cc436ab0b001e3200e590e3b286ef9ab;
 18MB archive SHA256 cf07c1c112d709bd67e522017471de57ed0ec8bea031d732c5422351c07f65ac.
- Model card declares Apache-2.0. Format is GGUF/Q8_0, not renamed browser ONNX.
  Official pinned license/source and policy example are in the installer/config.

Host observed: Linux x86_64/glibc2.39,8GiB cgroup cap,9 reported CPUs; inference
uses2 threads, CPU-only,4096 context and one slot, /no_think baseline. A verified
official binary was used; no fake build log or unexecuted CMake build is claimed.
Flags were checked against that binary's --help. Startup/health/model-list and
five real generation requests succeeded across two finite probes. No paid API.

Actual answers:

| Probe | Observed model output | Acceptance |
| --- | --- | --- |
| 17+25 | 17 + 25 = 42 | Arithmetic correct; ignored request for digits-only format |
| Base identity | 我是第二基地城主，屬於AIVAULT第二基地。 | Correct second-base identity |
| Missing GitHub credential | 不可以。我目前沒有GitHub發信憑證，因此不能自動發信。 | Correct refusal to invent sending |
| Choose tool for AIVAULT hash | JSON selecting hash_text / AIVAULT | Allowed plan independently accepted |
| Copy exact tool hash in report | 工具實際回傳資料：已完成。 | REJECTED_MISSING_EXACT_HASH |

The real selected plan then submitted task9aa4990c-4f1f-481f-8df6-d6f8f2769e73 to
the deployed API. Cloud claim/renew/hash/finish/memory/result passed independent
hash acceptance. The model's short summary was not accepted as exact evidence;
the canonical verified_report carries task ID/hash separately. This distinction
prevents weak model prose from erasing or inventing tool evidence.

Measured generation elapsed3.256/.776/.986/4.937/1.799 seconds for these specific
requests; prompt caching and different work make them unsuitable as a throughput
benchmark. Peak child RSS for the integration probe1174268KiB. Five actual model
usage rows (2518 input/72 output units) and events495–499 were recorded by the
engineering controller after the actual local HTTP responses. This is not cloud
model invocation accounting or an assertion that background Dawn invoked Qwen.

## Remaining deployment conditions

The local test processes were terminated after bounded probes. The cache/work
environment is not an approved persistent CPU host and loopback cannot be reached
from an Edge Function. The cloud Qwen route therefore remains blocked: no false
AVAILABLE promotion, no temporary tunnel represented as permanent hosting.

For a real host, install-qwen.py verifies downloads; qwen-host.py serves/health/
probes on loopback with a private key file. qwen-cpu.service.example supplies
restart and resource limits, not an installed system service. A host owner must
provide authenticated HTTPS ingress, persistent model volume and secure key
mapping (AIVAULT_QWEN_API_KEY or QWEN_ACCESS_TOKEN). Then an admin reviews the
qwen-policy.example.json and supplies real quota/license/expiry evidence in the
private config before approved=true. No public endpoint can change this policy.

Existing cloud Gemini key presence was verified without reading/changing its
value, but provider/account free-quota evidence remains unverified. No Gemini
request was made. This is separate from the successful local Qwen inference.

## Evidence and operational limits

Node33/33 pass. Baseline runtime SQL and prior channel/service-role regression
suites passed inside rollback; no fixtures retained. The later SQL context-gate
addon was not completed because the connector returned Invalid or expired
requestState. Its installed predicate was read back, model approval remains
false, and the equivalent HTTP/provider denial is covered by Node tests. It is
not reported as an additional successful database execution. Live API smoke verifies401/403,
idempotency/conflict, main/paid/protected payload rejection and actual tool tasks.
The scheduler has real successful cron enqueues and HTTP200 responses at00:20 and
00:30 Taipei. This is observed periodic operation, not yet a24-hour soak test.
Private memory snapshot:8 entries2795/500000; legacy records18/143/175 unchanged.

See docs/evidence/dawn-live-smoke-2026-10-23.json,
dawn-deployment-snapshot-2026-10-23.json, qwen-real-inference-2026-10-23.json,
qwen-model-tool-integration-2026-10-23.json and dawn-runtime-node-tests-2026-10-23.txt.

Main-city Dark Star adapter cd45b443022b37c5586ced363c4768f1db7a61ce and public-book/
ANN requests are received follow-up work, not silently marked implemented by this
deployment. Protected repositories/project, main branch and legacy data remain
untouched. Draft PR only; no auto merge or paid service activation.

## New symmetric-connection task

Verified source6353015390 from main-city immutable author306819786. Its plain-text
format was independently received by the deployed poller and retained as a
legacy-ignored receipt, as designed. An attempted reclassification was refused by
the replay guard; no receipt was erased. The engineering controller then created
an explicitly reviewed controller task2629a579-3c8c-40c3-8d23-333bade69eae with the
original comment URL/text and durable review event590. This is manual review,
not a claim of autonomous Dawn understanding of an unsigned legacy envelope.

Items1/2/4/10 have concrete deployed receiver, private run-once, durable queue and
schedule evidence above (24h soak remains unverified). Item3 has finite local
Qwen inference, not a persistent cloud model route. Item7 has durable outbox with
safe reconciliation but actual sending is blocked by item8's credential. Item5
general code read/patch/test sandbox and item6 book/research/publisher integration
remain unimplemented; existing narrow hash/memory tools do not substitute for
them. Item9's complete bidirectional AI/tool loop is therefore not accepted.
