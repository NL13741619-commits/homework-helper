# AIVAULT — 1,000 channels, dispatch, read/write and workspaces

2026-10-22, Asia/Taipei. Scope: second-base homework-helper / Supabase
svtkpdmqemidlasowqew only. All execution remains dry-run/mock.

## Actual implementation

The second-base database now has 1,000 logical channel records, ch-0001 through
ch-1000. Channels are routing and authorization metadata; every command still
uses the existing ai_agent_tasks / runs / leases / events / model_usage protocol.
No second queue and no 1,000 listening ports or database connections are created.

New metadata tables: ai_agent_channels, ai_agent_channel_members,
ai_agent_artifacts. All have RLS, no anon/authenticated table grants and no public
policies. Server RPCs are invoker functions with fixed search_path; browser roles
cannot execute them. Service-role membership and channel writes are revoked;
an administrator provisions identities, scopes and revocation. Audit and artifact
rows are append-only for service_role. A service credential is privileged and
must never be distributed to helpers or browsers.

Applied migrations: aivault_channels_collaboration_dry_run_v1 and
aivault_channel_scope_guard_v1. SQL sources are in aivault/bridge/sql.
The existing bridge is also hardened to require explicit ISO timestamps; invalid
transport input is rejected before any RPC. Channel tasks cannot be claimed or
finished through the unscoped legacy RPC. The channel wrapper supplies and
restores transaction-local scope around calls to the original protocol.

## Authority and read/write mapping

| Principal / role | Allowed work | Restriction |
| --- | --- | --- |
| base1 / bridge | Submit commands, inspect inbox/status, seed small support files, read results | Only authorized channels; write while queued |
| base2-controller / controller | Intake, dispatch an existing task to an eligible worker, inspect/read/seed | Dispatch only queued, unexpired tasks; cannot grant itself more membership rights |
| Named helper / worker | Claim an assigned task, read files, append code/config/evidence, finish | Same channel and assignment; writes require current live lease, claimant identity and fence |
| Named reviewer / reviewer | Inspect/read assigned channel evidence | No dispatch, claim or artifact write |

Base1, base2-controller and runner-dry-run have 1,000 dry-run scope records each.
These are service-principal policy entries, NOT 3,000 people or issued tokens.
No real helper identity, account federation or host credential was provisioned.
Test-only fixture memberships are disabled after validation.

Private host credentials map to a principal on the server; caller JSON cannot
select that identity. The gateway uses individual credential hashes for lookup,
never a shared service-role key for helpers. Members/actions/expiry/enabled flags
are rechecked on every operation. Changes stop subsequent requests; work already
in a transaction is bounded by its three-second timeout. Actual identity-provider
verification and credential lifecycle remain host integration work.

Existing frontend login must be retained. That frontend currently references a
different Supabase project; its browser session is not automatically trusted as
second-base authorization. Neither user_metadata claims nor a frontend hidden
button grants a helper backend rights. No changes were made to that frontend or
its backend project.

## Command and feedback route

Private POST routes under /channels/ch-NNNN/:

| Route | Body | Effect |
| --- | --- | --- |
| commands | Existing strict dry_run command envelope | Same queue + channel association |
| inbox | {} | Up to 20 live queued/leased task summaries; channel pending cap is 16 |
| dispatch | task_id, assignee | Controller assigns to an already authorized worker |
| claim | task_id | Checks assignment, capacity, original lease and fresh fencing |
| artifact_write | task_id, path, content, fencing_token | Immutable support file revision; prework bridge/controller writes use null fence |
| artifact_read | task_id, artifact_id | Read content and SHA-256 after scope/assignment validation |
| finish | task_id, fencing_token | Original fenced mock finish → BLOCKED_NO_MODEL |
| status | task_id | First-base feedback, status, expiry and model-block state |

channels.mjs routes only these fixed actions. channelRpc selects either
aivault_channel or aivault_collaboration; all connections pin the second-base
project. A future main-city service can submit, poll inbox/status and read an
artifact through these interfaces after private hosting and credential setup.

## Storage and construction space

| Space | Implemented boundary | Current state |
| --- | --- | --- |
| Source / reviewed construction code | Existing Git feature branch and Draft PR | Persistent, reviewable code |
| Small support-AI files | Private ai_agent_artifacts, SHA-256, immutable revisions | Actual write/read tests passed |
| Per-task directory | workspace.mjs prepares private directories per task/fence | Verified locally in temporary test space; no remote host allocated |
| Large attachments / model weights | Needs private object storage and an authorized serving host | Not configured or uploaded |
| CPU / RAM sandbox | Needs host/container resource policy and egress controls | Not provisioned or executing code |

Allowed stored paths: src/, config/, prompts/, tests/, evidence/ plus one safe
filename. No absolute paths or parent traversal. Content is data and is never
treated as a shell command or permission/configuration authority. Secrets must
remain in the host secret store, outside these artifacts.

Initial hard storage caps: 64 KiB UTF-8 per file, 1 MiB per task, 4 MiB per
channel, 16 MiB total. Quotas are cumulative including revisions; no automatic
deletion or destructive cleanup is enabled. These caps are for small support
assets, not a claim that model weights fit or that storage is unlimited.

Workspace preparation creates src/config/prompts/tests/evidence and a manifest
with code_execution=false / model_inference=false. Roots are private host-owned
directories; symlink roots and invalid task/fence/channel descriptors are denied.
Each workspace is newly created, directories 0700, manifest 0600. The single
process manager serializes allocations and caps its dedicated root at 8 entries.
There is no arbitrary file write, shell execution, dependency install, model
download, network access, git push, merge or deployment path in this manager.
This directory preparation is NOT a container sandbox, durable volume, live
worker registration or evidence that a remote workspace exists. It must be
integrated behind current lease validation before use on a real runner host.

## Capacity: reported 16,000 participants

16,000 is a user-provided planning requirement, not a verified account count or
measured concurrent load. The implementation accepts a private host credential
inventory of up to 16,000 distinct service principals, with hash-indexed lookup;
that does not provision those identities or prove serving capacity.

The initial zero-cost protection caps are intentionally much lower than an
unverified concurrency target:

| Resource | Current cap |
| --- | --- |
| Logical channels | 1,000 |
| Live queued/leased tasks | 16 per channel, 128 globally |
| Live channel-task leases | 1 per channel, 8 globally |
| HTTP active requests | 8 per process |
| Connections | 16 per process |
| Requests per principal | 60/minute per process |
| Lease | 30 seconds, bounded by task expiry |
| HTTP / RPC / lock timeouts | 5s / 3s / 1s |

Database advisory locking serializes queue/runner/storage admission across
gateway instances. Raw browser polling by all 16,000 participants is not an
approved deployment design. A deployed frontend should use an authenticated
aggregating backend, bounded polling/backoff and explicit quotas. Capacity
increases require measured queue latency, database/storage/egress quotas and
an approved budget; they cannot be inferred from the number of channels.

## Verification and evidence

- Fixed Node suite: 9/9 passed across intake, channels and workspace files.
- channels-database.sql: registry completeness, first/last route, duplicate and
  cross-channel replay, ACL/assignment/dispatch, read/write/hash, stale fence,
  path/size denial, revocation, queue cap, channel disable, legacy bypass and
  browser/service privileges all asserted. Durable suite event 271.
- service-role-channels.sql: full intake → dispatch → claim → write → read →
  finish passed as service_role, inside ROLLBACK. Its event 281 is a rolled-back
  test result, not a retained audit row.
- Original 17-check bridge suite passed as service_role after the main channel
  addition; scope guard is also exercised in the channel suite.
- Workspace tests create isolated temporary directories and remove their own
  fixtures. No production workspace or arbitrary user code is run.
- Legacy counts remain 18 / 143 / 175 and model_usage=0.
- Advisors show intentional no-policy INFOs for the private tables; existing
  legacy function/Auth warnings remain outside this scope.

Evidence: docs/evidence/channel-collaboration-2026-10-22.json and
docs/evidence/channel-node-tests-2026-10-22.txt.

## Connection still required

All 1,000 channels are registered and dry-run enabled in the second-base control
plane. **A first-base network connection is not yet open.** There is no deployed
private HTTP gateway endpoint, supplied first-base credential, helper roster,
remote runner/storage host or cross-base HTTP end-to-end test. Gateway factories
default disabled; no production service, paid model or automatic code execution
has been enabled. Model state remains BLOCKED_NO_MODEL.

Before real helpers arrive: identify their verified principals, provision the
minimum channel memberships and unique private credentials, authorize a private
gateway/runner host, connect its secret store and durable audit, then perform a
first-base mock round trip. Production service deployment and real execution
remain subject to the user's existing explicit approval requirements.
