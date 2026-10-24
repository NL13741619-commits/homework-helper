# 曙光自建即時語音（非 Gemini Live · 拒電音合成）

第二基地獨立測試頁：`app/dawn-own-voice-test.html`  
實驗室頁（非產品聲）：`app/dawn-voice-free.html`

## 方針

- **不用 Gemini Live**、不連 `technical-dark-star-live-voice-v2`、不把 `dawn-city-ai` WebSocket 當語音依賴。
- `dawn-city-ai` 目前上游是 Gemini Live，本輪**不接線**；另建模組，帶關閉開關。
- 不呼叫圖生影片／`dawn-light-video`／`dawn-light-photo-video`／付費 Grok／Kling／Magic Hour。
- 不修改第一基地 `m9wmtcb782-arch/AIVAULT` 正式頁。

## 產品音色政策（2026-10-24）

使用者明確拒絕：「聲音太假，不要電腦合成的電音。」

| 項目 | 狀態 |
|------|------|
| 瀏覽器 `speechSynthesis`／Web Speech TTS 當**產品聲** | **REJECTED** |
| 產品播音 | **靜音**，直到認可路徑就緒 |
| 認可參考檔 `dawn-natural-female-v2.wav` | **MISSING**（倉庫尚無實體檔；請向使用者／GPT 索取） |
| 免費自然神經 TTS（例如未來 Qwen3-TTS） | **NOT_DEPLOYED**（需 GPU／部署核准） |
| 除錯合成 `?synth=1` 或實驗室「暫時解鎖」 | 允許工程聽一下，**仍標 REJECTED**，不得當產品聲 |

**認可路徑（唯一產品方向）：**

1. 放入並校驗 `app/assets/dawn-voice/dawn-natural-female-v2.wav`（逸豪已認可之自然年輕女聲參考）。
2. 接上免費／自架自然神經 TTS（候選：Qwen3-TTS 等 Apache-2.0 開放權重），以參考檔做音色條件或微調。
3. 通過實機聽感後，才可標產品 TTS＝AVAILABLE。

不得把 API 轉送、預錄假回答、或瀏覽器電音合成冒充「曙光已接通自然語音」。

## MVP 管線（現況）

1. **麥克風**：`getUserMedia` → 結束／離頁釋放。
2. **STT**：瀏覽器 Web Speech API（`SpeechRecognition`）— **僅辨識**，不是產品聲。不支援時標示 NOT LIVE，改打字。
3. **對話**：
   - 預設／`?mock=1`：本機腳本回覆（明確 MOCK）。
   - 可選：第二基地 `aivault-brain-gateway` 文字（需登入且 model_policy 就緒）；失敗則回落 MOCK 並標示原因。
4. **產品 TTS**：**靜音**。字幕照常顯示。`speak()` 預設不呼叫 `speechSynthesis`。
5. **插話**：若除錯合成正在播，偵測到新語音／按「插話」→ `cancel()`。
6. **字幕**：使用者與曙光文字列在對話區。
7. **重連**：STT 結束後若仍在聆聽會自動重開；失敗顯示狀態。

## 關閉開關

- URL：`?voice=0`
- 或 `localStorage.DAWN_OWN_VOICE_OFF=1`
- 除錯電音（非產品）：`?synth=1`

## 驗收邊界

- 本機／桌面瀏覽器可測 mic 權限、字幕、插話、釋放。
- **未**宣稱產品自然女聲已接通。
- **未**宣稱 iPhone Safari 成功，直到實機量測延遲與斷音。
- mock 測試 ≠ 真實模型已接通；字幕 ≠ 產品播音。

## 與 media 中心其他頁的關係

- `app/dawn-voice-free.html`：實驗室；朗讀預設關閉，解鎖後仍標 REJECTED。
- `app/dawn-own-voice-test.html`：連續聆聽 MVP（插話、字幕、重連、釋放 mic、MOCK 對話；產品播音靜音）。
- 兩者皆 **禁用 Gemini Live**，且 **拒絕瀏覽器合成當產品聲**。

## 下一步（需父代理／使用者）

1. 向使用者或 GPT 索取 `dawn-natural-female-v2.wav` 實體檔並放入倉庫。
2. 規劃免費神經 TTS 部署（Qwen3-TTS 等）與授權核對。
3. 草稿 PR 合併前聽感驗收；未核准不得 force-merge。
