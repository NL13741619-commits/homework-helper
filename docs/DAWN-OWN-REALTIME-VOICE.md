# 曙光自建即時語音（非 Gemini Live）

第二基地獨立測試頁：`app/dawn-own-voice-test.html`

## 方針

- **不用 Gemini Live**、不連 `technical-dark-star-live-voice-v2`、不把 `dawn-city-ai` WebSocket 當語音依賴。
- `dawn-city-ai` 目前上游是 Gemini Live，本輪**不接線**；另建模組，帶關閉開關。
- 不呼叫圖生影片／`dawn-light-video`／`dawn-light-photo-video`／付費 Grok／Kling。
- 不修改第一基地 `m9wmtcb782-arch/AIVAULT` 正式頁。

## MVP 管線

1. **麥克風**：`getUserMedia` → 結束／離頁釋放。
2. **STT**：瀏覽器 Web Speech API（`SpeechRecognition`）。不支援時標示 NOT LIVE，改打字。
3. **對話**：
   - 預設／`?mock=1`：本機腳本回覆（明確 MOCK）。
   - 可選：第二基地 `aivault-brain-gateway` 文字（需登入且 model_policy 就緒）；失敗則回落 MOCK 並標示原因。
4. **TTS**：瀏覽器 `speechSynthesis`（臨時）。認可檔 `dawn-natural-female-v2.wav` 缺失時不得宣稱音色已接通。
5. **插話**：播放中偵測到新語音／按「插話」→ `speechSynthesis.cancel()`。
6. **字幕**：使用者與曙光文字列在對話區。
7. **重連**：STT 結束後若仍在聆聽會自動重開；失敗顯示狀態。

## 關閉開關

- URL：`?voice=0`
- 或 `localStorage.DAWN_OWN_VOICE_OFF=1`

## 驗收邊界

- 本機／桌面瀏覽器可測 mic 權限、字幕、插話、釋放。
- **未**宣稱 iPhone Safari 成功，直到實機量測延遲與斷音。
- mock 測試 ≠ 真實模型已接通。
