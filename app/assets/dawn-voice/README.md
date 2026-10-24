# Dawn voice assets (Base 2)

| File | Role | Product status |
|------|------|----------------|
| `dawn-natural-female-v2.wav` | **Current conversational speaking reference** (await clean speak sample) | REFERENCE_WAV_READY · neural clone BLOCKED_NEED_GPU · **not AVAILABLE** |
| `dawn-singing-melody-ref-v1.wav` | **Singing / melody / 抑揚頓挫 character reference ONLY** (earlier 清唱 MP4, Option B) | SINGING_MELODY_REF_READY · **NOT** speaking TARGET · **not AVAILABLE** |
| `aivault-eot-v1-int8.onnx` | Optional future WASM EOT (from Base 1) | Not required for current energy VAD |

**Not in product assets (reports only):** Max Factor commercial extract  
`/workspace/reports/dawn-voice/dawn-natural-female-v3-speak-from-video.wav` — status **`CANDIDATE_REJECTED_AS_IS`** (loud BGM + ad/announcer prosody; pure speaking but not recommended as primary realtime speak corpus without isolation / clean re-upload). See `docs/DAWN-V3-SPEAK-CANDIDATE.md`.

Format for wav targets: 24 kHz mono PCM s16 preferred.

Never treat browser speechSynthesis as Dawn product voice. No Gemini Live dependency. Never mark AVAILABLE from these assets alone.
