# Dawn voice assets (Base 2)

| File | Role | Product status |
|------|------|----------------|
| `dawn-natural-female-v3-speak.wav` | **Provisional conversational speaking TARGET** (Max Factor Lipfinity TW ad VO · Demucs htdemucs isolated · user override t307u) | REFERENCE_TARGET_READY · neural clone BLOCKED_NEED_GPU · **not AVAILABLE** |
| `dawn-natural-female-v2.wav` | Earlier speaking anchor | Kept; do not delete; secondary preview |
| `dawn-singing-melody-ref-v1.wav` | Singing / melody / 抑揚頓挫 character reference ONLY (earlier 清唱 MP4, Option B) | SINGING_MELODY_REF_READY · **NOT** speaking TARGET · **not AVAILABLE** |
| `aivault-eot-v1-int8.onnx` | Optional future WASM EOT (from Base 1) | Not required for current energy VAD |

Honest notes on v3: ~12s; source had loud BGM; Demucs isolation attempted; **residual BGM may remain**; ad/announcer prosody (not casual chat). See `docs/DAWN-SPEAKING-V3.md`.

Format: 24 kHz mono PCM s16 preferred. Never treat browser speechSynthesis as Dawn product voice. No Gemini Live. Never mark AVAILABLE from these assets alone.
