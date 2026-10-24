# 曙光自有聲線資產（第二基地）

## 產品政策（2026-10-24）

瀏覽器 `speechSynthesis` **不是**曙光正式聲音。

| 階段 | 狀態 |
|------|------|
| 認可參考 wav | **REFERENCE_WAV_READY**（可預覽錄音本身） |
| 即時產品 TTS（神經克隆／串流） | **BLOCKED_NEED_GPU** / **PENDING_FREE_NEURAL_TTS** — 不得標 AVAILABLE |
| 瀏覽器電音合成當產品聲 | **REJECTED**（預設靜音） |
| 產品歌唱 | **NOT AVAILABLE**（父代理驗證 PR #25；站上僅 REFERENCE_PLAYBACK／DSP 實驗） |

預覽「認可錄音」≠ 即時 TTS。聽參考檔 OK；用 Web Speech 冒充曙光說話不行。

## dawn-natural-female-v2.wav

- **狀態：PRESENT（REFERENCE_WAV_READY）**
- 路徑：`app/assets/dawn-voice/dawn-natural-female-v2.wav`
- 格式：PCM s16le，**24000 Hz**，mono，約 **5.16 s**，247560 bytes
- **SHA-256：** `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce`
- 來源：使用者 2026-10-24 上傳（逸豪認可自然年輕女聲參考）
- 用途：Qwen3-TTS／CosyVoice 等免費神經 TTS 的參考／克隆條件；說＋唱同一聲線身份
- 本機無 GPU → 即時克隆 **BLOCKED_NEED_GPU**

## aivault-eot-v1-int8.onnx

- 主城 EOT v1 int8（約 821KB）
- 用途：回合結束偵測；**不是**語音合成模型

Gemini Live／付費 TTS：禁用。
