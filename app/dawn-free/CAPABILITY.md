# 曙光免費媒體能力（第二基地）

| 模組 | 路徑 | 引擎 | 狀態 | 授權 |
|------|------|------|------|------|
| JPG 海報 | `app/dawn-jpg-studio.html` | Canvas + toBlob JPEG | AVAILABLE（本機） | AIVAULT-owned 程式 |
| AI 插畫 | edge `dawn-light-image` | （無） | BLOCKED_NO_FREE_IMAGE_PROVIDER | — |
| 語音 TTS/ASR | `app/dawn-voice-free.html` | Web Speech API | AVAILABLE_BROWSER | 瀏覽器／OS |
| Gemini Live | （既有 dawn-light-live-voice.js） | Gemini | DISABLED_BY_POLICY | 不用 |
| 歌唱 DSP | `app/dawn-music-free.html` | Web Audio | EXPERIMENTAL_DSP_SINGING | AIVAULT-owned |
| 短片 | `app/dawn-short-video-free.html` | Canvas + MediaRecorder | AVAILABLE*（視瀏覽器） | AIVAULT-owned |
| Magic Hour 圖生影片 | edge dawn-light-* | Magic Hour | GATES_CLOSED | 禁止呼叫 |

主城暗星 JPG：`dawn-light-image` → `dark-star-image-generation`（Gemini image）。第二基地**不**代理該路徑。
