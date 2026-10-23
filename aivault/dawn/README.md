# 曙光 / Dawn Light — 第二基地最小程式移植

Source: m9wmtcb782-arch/AIVAULT, pinned commit
`36559f3ac8c7af9d37e51d5130df06dd45bc63ae`.

Status: **MINIMAL_TEXT_PORT_PREPARED / BLOCKED_NO_MODEL / NOT_DEPLOYED**.
This is a role and text-interface port, not a transferred trained model or an
operating AI service. No real inference was performed.

## Files

- profile.mjs: dawn-light identity, original text prompts and adapted research rules.
- dawn-light.html / page.mjs: isolated frontend with source-inspired sun identity;
  disabled until its host integrates second-base login/task callbacks.
- client.mjs: second-base-only text request adapter; uses a user session, never
  a model key or the primary base's public/secret token.
- gateway.mjs: default-disabled private handler and single Gemini text transport;
  neither is started or deployed by importing it.
- manifest.json: pinned source paths, Git blob SHA and SHA-256, verified API blob
  matches, source uses/dependencies/exclusions, licensing and port-file hashes.
- verify-port.py: reproducible byte verification. With no flag it only downloads
  pinned public source into memory to hash; it performs no model calls.

```sh
python3 aivault/dawn/verify-port.py
node --test aivault/dawn/test/dawn.test.mjs
```

No upstream raw file containing credentials is committed. All original voice,
image, video, 3D, shared-memory and cross-base RPC paths are excluded.

## Host integration still required

1. Preserve the existing login. Authenticate a SECOND BASE session against its
   issuer, then map the verified identity to a scoped service principal. A
   first-base session or user-editable role field is not authorization here.
2. Host-owned AIVAULT_DAWN_INTEGRATION callbacks supply getSession and
   getTaskContext. Never put Gemini keys in the browser or local storage.
3. Wire authorize/reserveInvocation/finishInvocation/audit to reviewed private
   control RPCs using existing tasks, channel membership, runs, leases, events and
   model usage. Do not create a separate Dawn queue. Browser clients cannot
   directly read/write those control tables.
4. Reservation must atomically validate identity, assigned task/channel, live
   lease/fence, task expiry, explicit inference authorization and free-only quota;
   enforce one invocation per approved task/fence, not just a fresh request ID.
   Completion must revalidate fencing and durably store usage and evidence.
   Failed or abandoned reservations need bounded expiry/reconciliation, without
   automatically retrying an unknown provider outcome or enabling paid fallback.
5. Existing intake currently admits dry_run/mock tasks only. Those tasks are
   deliberately rejected by this gateway; no execution-mode/schema change was
   applied. Required reservation/completion RPCs are not implemented in this port.
6. A trusted model policy must specify a verified model, free-only quota evidence,
   a short validity period and ≤256 output tokens. Existing secret value remains
   untouched. The server resolver reads GEMINI_API_KEY (or explicitly chooses
   AIVAULT_GEMINI_API_KEY); there is no default model or alternative provider.
   Setting flags is not proof of free pricing: host approval must be backed by
   verified provider billing/quota evidence before enabling the handler.
7. Configure exact allowed origins, server rate/concurrency/resource limits,
   durable audit and an authorized private host before any service deployment.

The code pins text requests to the second-base function path
`/functions/v1/aivault-dawn-text`; that function does not exist as a deployed
service from this delivery. This path is an integration contract, not a live URL.

## Validation boundary

All tests use fixture identities, fixture model IDs/secrets and mock transports.
Mock output is explicitly MOCK_TEST_ONLY with inference_executed=false. Paid or
expired policy, missing authentication/control, wrong project, extra model/system
fields, dry-run task, wrong/expired fence, failed audit, provider failure and stale
completion fail closed. No fallback request is made on a provider error.

Voice remains blocked because the primary relay implementation was not supplied
in the verified file set. Images, vision, video and 3D are not ported or enabled.
No first-base user data, historical job IDs, memory, environment values or rights
are imported. All source access was read-only; no primary backend was called.

## Attribution and license scope

This adaptation follows the user's project-specific dual-base copy authorization.
Source paths and hashes are retained in manifest.json. The pinned root LICENSE
path returned 404; that does not establish absence of all licenses or grant broad
third-party redistribution. No third-party libraries, image/video/voice assets,
model weights or original SQL are bundled. Wider redistribution needs its own
license review.

Gemini transport format checked against official API reference:
https://ai.google.dev/api/generate-content . This is format verification only,
not proof that any configured model exists, is free, or can be used with the
second base's existing credential.
