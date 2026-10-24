# Dawn voice assets (Base 2)

| File / folder | Role | Product status |
|------|------|----------------|
| `dawn-natural-female-v3-speak.wav` | Conversational speaking TARGET (Max Factor Lipfinity TW ad VO · Demucs · user override t307u) | REFERENCE_TARGET_READY |
| `colab-qwen3-v3-candidates/` | Qwen3-TTS Colab T4 clone samples from v3 · ear-check PASS (t324u 「很好」) | **SPEAK_CANDIDATES_EAR_OK** · LIVE TTS still **BLOCKED_NEED_GPU_HOST** · **not AVAILABLE** |
| `dawn-natural-female-v2.wav` | Earlier speaking anchor | Kept; secondary preview |
| `dawn-singing-melody-ref-v1.wav` | Singing / melody ONLY (Option B) | SINGING_MELODY_REF_READY · **NOT** speaking TARGET |
| `aivault-eot-v1-int8.onnx` | Optional future WASM EOT | Not required for energy VAD |

Honest one-liner: `SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`

v3 notes: ~12s; residual BGM possible; ad prosody. Candidates: 24 kHz mono. Never treat browser speechSynthesis as Dawn product voice. No Gemini Live. Never mark AVAILABLE from assets or ear-check alone — need self-host GPU inference (`aivault-voice`).
