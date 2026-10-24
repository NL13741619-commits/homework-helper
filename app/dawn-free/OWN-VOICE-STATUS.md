# Dawn own realtime voice — capability (honest)

| Layer | Status | Notes |
|-------|--------|-------|
| Mic + release | WORKS | getUserMedia |
| Energy VAD / EOT 700ms | WORKS | client-side |
| STT | WORKS* | Web Speech **recognition only** |
| Dialogue MOCK | WORKS | `?mock=1` |
| Dialogue brain gateway | REQUIRES_LOGIN | no paid fallback |
| Reference wav | **REFERENCE_WAV_READY** | 24 kHz mono; SHA in assets README; preview OK |
| Reference prosody (crude) | HAS_VARIATION | F0 range ~278 Hz, CV ~0.22 — not dead-flat |
| Product TTS live | **BLOCKED_NEED_GPU** | need Qwen3-TTS/CosyVoice instruct/emotion |
| Browser/Piper product | REJECTED | flat/電音 |
| Gemini Live | FORBIDDEN | |
| iPhone Safari E2E | NOT_VERIFIED | |

Never mark product TTS AVAILABLE until prosody hear-test passes.
