# 曙光免費媒體能力（第二基地）

| 模組 | 路徑 | 引擎 | 狀態 | 授權 |
|------|------|------|------|------|
| JPG 海報 | `app/dawn-jpg-studio.html` | Canvas + toBlob JPEG | AVAILABLE（本機） | AIVAULT-owned |
| AI 插畫 | edge `dawn-light-image` | （無） | BLOCKED_NO_FREE_IMAGE_PROVIDER | — |
| 產品語音 TTS | — | 需 natural wav + 神經 TTS | **PENDING_NATURAL_CLONE** / **BLOCKED_NO_NATURAL_TTS** | — |
| 瀏覽器 speechSynthesis | `dawn-voice-free.html` | Web Speech | **REJECTED**（預設靜音；非產品聲） | 瀏覽器／OS |
| Gemini Live | （舊 live-voice.js） | Gemini | DISABLED_BY_POLICY | 不用 |
| 自架 Qwen3-TTS | `app/services/aivault-voice` | 開源權重 | NOT_DEPLOYED | Apache-2.0 上游 |
| 歌唱 DSP | `app/dawn-music-free.html` | Web Audio oscillator | EXPERIMENTAL_DSP_SINGING（**非產品歌唱**） | AIVAULT-owned |
| 短片 | `app/dawn-short-video-free.html` | Canvas + MediaRecorder | AVAILABLE* | AIVAULT-owned |
| Magic Hour | edge dawn-light-* | Magic Hour | GATES_CLOSED | 禁止呼叫 |

`dawn-natural-female-v2.wav`：見 `app/assets/dawn-voice/` — 目前 **MISSING**。
