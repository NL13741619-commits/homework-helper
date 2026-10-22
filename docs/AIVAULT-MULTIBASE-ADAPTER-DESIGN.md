# AIVAULT multi-base Bridge Adapter — design and isolated tests

2026-10-22 (Asia/Taipei). User rule: read this base's own inbox, verify the
originating base, then reply into that verified base's registered inbox.

Actual inbound messages read in the second-base inbox:
- 6342222032: first-base communication/support request.
- 6342365447: multi-base protocol v1 and adapter-design request.

Both authors were verified through GitHub metadata as user ID 306819786
(m9wmtcb782-arch). Self-authored receipt 6342199614 is not a new inbound command.

## Registered bases and authority

| Base | Verified GitHub user ID | Repository ID | Fixed inbox |
| --- | --- | --- | --- |
| base-001 | 306819786 | 1333439173 | https://github.com/m9wmtcb782-arch/AIVAULT/issues/30 |
| base-002 (local) | 305579832 | 1318351142 | https://github.com/NL13741619-commits/homework-helper/issues/1 |

Machine-readable registry: aivault/bridge/base-registry.json. Its contents are
reviewed configuration, not client input. A new base needs a unique base_id,
verified principal and approved inbox before registration. An incoming message
cannot register a base, change a reply URL, delegate identity or enable tasks.
The initial test validator denies ambiguous shared GitHub identities; supporting
one account for multiple independently trusted bases requires an explicit signed
identity/delegation design before enabling that arrangement.

## Receive, verify, process, reply

1. Read the local registered inbox (or verify its webhook then refetch the comment
   with the authenticated GitHub API). Reject a different repository ID/issue.
2. Resolve sender from immutable GitHub user ID against the registry. Ignore
   local-base self messages. Unknown or ambiguous authors go to review.
3. Validate message_id, from_base, to_base, reply_to, sent_at, kind and body;
   task_id and in_reply_to are optional. Bound the envelope to 16 KiB.
   from_base must match the verified author; to_base must equal the local base;
   reply_to must equal the sender's registered inbox. Never follow a URL provided
   solely by untrusted body text.
4. Use repository ID + GitHub comment ID as the transport dedupe identity, and
   from_base + message_id as the cross-delivery message identity. Compare content
   fingerprints. Duplicate delivery has no second effect; edited content or ID
   collision is quarantined for review.
5. Classify correspondence vs a command proposal. Plain text, including the two
   legacy messages above, is manually reviewed and acknowledged; it is never
   executed or automatically converted into a task.
6. For an approved structured command, map to the existing channel intake and its
   strict dry_run contract. All source identity, scope, expiry, idempotency,
   protected-target, zero-cost, lease and fencing gates remain in force.
7. Read the local inbox again before a send. Resolve the recipient in the approved
   registry, and post the reply to that base's inbox. Include in_reply_to and the
   original comment reference. Own-inbox audit/state is stored in the backend;
   it does not require posting another outbound command to the local inbox.

An outbound reply from base-002 to base-003 therefore goes to base-003's inbox,
not always to base-001. The isolated tests exercise a fictitious third base only;
that fixture is not registered or contacted in the real environment.

## Envelope example

```json
{
  "message_id": "base-002-reply-6342365447",
  "from_base": "base-002",
  "to_base": "base-001",
  "reply_to": "https://github.com/NL13741619-commits/homework-helper/issues/1",
  "sent_at": "2026-10-22T14:00:00Z",
  "kind": "receipt",
  "in_reply_to": "github:1318351142:comment:6342365447",
  "body": "已收到；此為收件回覆，不啟用施工。"
}
```

reply_to is the sender's registered return inbox. in_reply_to identifies the
original message; for legacy messages without a supplied message_id, the trusted
GitHub transport key is the normalization reference. sent_at is not authority to
execute; command lifetime is checked again by the existing task contract.

## Compatibility with existing AIVAULT control layer

| Adapter operation | Existing destination | Required implementation boundary |
| --- | --- | --- |
| Receive correspondence / receipt | ai_agent_events | Proposed immutable event with author/source/hash; no task created |
| Receive approved command proposal | ai_agent_tasks via /channels/ch-NNNN/commands | Deterministic command_id derived from source transport key; registered principal + channel scope |
| Review/assign | Existing inbox/dispatch | Controller scope; approved worker membership |
| Claim/reclaim | Existing claim + ai_agent_leases | Same atomic row locks and current fencing token |
| Files/evidence | Existing artifact_read/artifact_write | Same assignment, quota, live lease/fence and hash gates |
| Status/reply | Existing status/events + destination GitHub issue comment | Registry routing, linked task/commit/test evidence |
| Cost/model request | Existing policy and ai_model_usage | BLOCKED_NO_MODEL until a separately approved credential/model exists |

No parallel message-task queue, worker queue or simplified bridge.tasks is
proposed. Communication receipts are event records, not runnable tasks. The
first-base /messages and /workers/requests interfaces need an authenticated
presentation adapter: correspondence maps to event records; worker requests are
review proposals, not deployed workers or automatic privilege grants.

Current channel code has legacy actor labels base1/base2. The approved registry
maps base-001/base-002 to those labels for the present two-base contract. Do not
collapse every future base into base1 or distribute its credential. Additional
bases require individual service principals, channel ACLs and a reviewed schema
extension before command submission is enabled for them.

## Durable idempotency and outbound send design

multibase-protocol.mjs is a pure reference validator/router. Its test Map is NOT
durable storage or a deployed replay defense. No task API is invoked by this
module; every command returns COMMAND_REVIEW_REQUIRED with submission disabled.

Before hosting: add a reviewed database RPC that atomically reserves an inbound
event key, checks its fingerprint, records the decision and, for an approved
command, creates the existing task in the same transaction. Enforce uniqueness
of receipt keys in ai_agent_events, not a new queue. Claim concurrent webhook and
poll deliveries with database locking/unique constraints; mark the event only
after the durable decision. No such schema extension is applied in this round.

For outbound receipts, persist a send-intent event and deterministic message_id.
Post a stable marker with that ID. A timeout after POST is an unknown outcome:
look up the destination issue for the marker before retrying, rather than
blindly producing a second comment. Record returned comment ID and source link.
Only the registered Issue target may receive the request. This is at-least-once
delivery with deduplication; exactly-once cross-system delivery is not promised.

## Deployment alternatives and minimum access

| Route | Prerequisites | Validation / current status |
| --- | --- | --- |
| GitHub App webhook (preferred design) | Authorized install/subscription, private HTTPS handler, strong server webhook secret, durable receipt RPC, private runtime | Verify X-Hub-Signature-256 over bounded raw bytes before parsing; refetch comment and verify identity/inbox; not deployed |
| Authorized polling fallback | Private scheduler/runtime, scoped GitHub credential, stored cursor/ETag, same durable receipt RPC | Poll local inbox only; follow all pages, handle updated comments, conditional reads, rate-limit/backoff; not scheduled |
| Current interactive agent | User-triggered GitHub connector read and reply | Actual receipt path verified; no background listener |

Communication GitHub App: Metadata read + Issues read/write on registered
repositories only. Read is for local inbox/status and destination dedupe; write
is for approved receipt comments. It does not need Contents, Workflows,
Administration, repository deletion, merge or deployment permissions. Keep any
future code-writing worker credential separate from the communication identity.

GitHub recommends webhook delivery over frequent polling. Fallback polling must
respect x-poll-interval when supplied, use authenticated conditional requests,
paginate and honor Retry-After/rate-limit reset with bounded exponential backoff.
Serialise communication API operations; avoid uncontrolled concurrent posts.
The operator must authorize the runtime and its quota before scheduling; no
paid infrastructure or model fallback is enabled here.

## Isolated validation and present limits

Six test groups cover local-inbox-first routing, immutable sender identity,
spoofed body/unknown base/wrong recipient/unapproved URL, third-base routing,
duplicate comments/message replay/edits, untrusted command/legacy text, timestamp
and size limits, required receipt storage, and webhook HMAC tampering.
Tests perform no network/DB writes and execute no task payload.

The existing nine intake/channel/workspace groups are also retained. Combined
suite output: docs/evidence/multibase-node-tests-2026-10-22.txt.

This delivery is a design + reference validator + isolated tests. There is no
deployed webhook, scheduled poller, durable adapter receipt transaction, new
HTTPS endpoint, automatic command ingestion or model execution. No first-base
code/schema/secrets, production deployment or protected Safe Reunion system is
modified. Follow-up implementation/deployment requires the user's existing gates.

Official references checked 2026-10-22:
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- https://docs.github.com/en/rest/issues/comments
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
