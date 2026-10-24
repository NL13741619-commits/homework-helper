# 曙光自建即時語音 MVP harden（2026-10-24 Asia/Taipei）

## Scope
Base 2 only: `NL13741619-commits/homework-helper`  
Branch: `feat/dawn-own-voice-mvp-harden` (draft PR)

## Wav status
**MISSING** — searched repo, stores, Grok Bot email keyword `dawn-natural-female-v2.wav`.  
Only marker: `app/assets/dawn-voice/dawn-natural-female-v2.MISSING.txt`.  
Test page accepts drop → IndexedDB (not auto-commit).

## What works for real
- Mic acquire + release on stop/pagehide
- Energy VAD + silence EOT default **700ms** (spec 500–800)
- Level meter, phase machine, barge-in flush + AbortController
- STT via Web Speech (**recognition only**, honest label)
- MOCK dialogue `?mock=1` / demo
- AUTO dialogue → Base2 brain gateway when logged in; else **ERROR_NO_AUTH** (no paid fallback, no silent fake success)
- Product TTS **MUTED**; browser synth only `?synth=1` labeled REJECTED
- Wav drop-in RIFF check + SHA-256 + preview when PRESENT
- Unit tests: 8/8 pass
- Screenshots under `/workspace/reports/dawn-voice/`

## MOCK / BLOCKED
| Item | Status |
|------|--------|
| Product natural voice | **NOT AVAILABLE** |
| `dawn-natural-female-v2.wav` | **MISSING** |
| Qwen3-TTS / CosyVoice | **BLOCKED_NEED_GPU** (no NVIDIA; torch not installed) |
| `dawn-own-tts` Edge Function | stub in repo, **not deployed**; returns 503 honest |
| Gemini Live | **FORBIDDEN** / not wired |
| iPhone Safari E2E | **NOT_VERIFIED** |

## User must provide
1. `dawn-natural-female-v2.wav` (upload in chat or place in assets)
2. Free GPU / self-host for neural TTS before AVAILABLE
3. Approve merge of draft PR + optional deploy of `dawn-own-tts`

## Paid
None called. Magic Hour / image→video untouched. Paid gate preserved.
