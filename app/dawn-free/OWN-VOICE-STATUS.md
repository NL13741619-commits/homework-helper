# Dawn own realtime voice — capability (honest)

| Layer | Status | Notes |
|-------|--------|-------|
| Mic + release | WORKS | getUserMedia |
| Energy VAD / EOT | WORKS | client-side（harden MVP） |
| STT | WORKS* | Web Speech **recognition only** |
| Dialogue MOCK | WORKS | `?mock=1` |
| Dialogue brain gateway | REQUIRES_LOGIN | no paid fallback |
| Reference wav | **REFERENCE_WAV_READY** | 24 kHz mono；可預覽 |
| Reference prosody demo | REFERENCE_PLAYBACK | `dawn-sing-ref.html` — 非神經唱 |
| Product TTS live | **BLOCKED_NEED_GPU** / **PENDING_FREE_NEURAL_TTS** | 不得標 AVAILABLE |
| Browser synth as product | **REJECTED** | 電音／假聲 |
| Product singing | **NOT AVAILABLE** | 父代理驗證 PR #25；勿宣稱上線 |
| Gemini Live | FORBIDDEN | |
| iPhone Safari E2E | NOT_VERIFIED | |

Never mark product TTS or singing AVAILABLE until free neural path + prosody hear-test passes.
