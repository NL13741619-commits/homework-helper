# Dawn voice assets (Base 2)

| File | Role | Product status |
|------|------|----------------|
| `dawn-natural-female-v2.wav` | **Current conversational speaking reference** (Option B) | REFERENCE_WAV_READY · neural clone BLOCKED_NEED_GPU · **not AVAILABLE** |
| `dawn-singing-melody-ref-v1.wav` | **Singing / melody / 抑揚頓挫 character reference ONLY** (from user 清唱 MP4, 2026-10-24 Option B) | SINGING_MELODY_REF_READY · **NOT** realtime speaking TARGET · **not AVAILABLE** |
| `aivault-eot-v1-int8.onnx` | Optional future WASM EOT (from Base 1) | Not required for current energy VAD |

Format for wav targets: 24 kHz mono PCM s16 preferred.

**Option B (user 2026-10-24):** Video-derived wav is singing/melody study only. Conversational speech stays on v2 until a better natural **speaking** sample lands (e.g. `dawn-natural-female-v3-speak.wav`). See `reports/dawn-voice/SPEAKING-PROSODY-SAMPLE-NEEDED.md`.

Never treat browser speechSynthesis as Dawn product voice. No Gemini Live dependency. Never mark AVAILABLE from these assets alone.
