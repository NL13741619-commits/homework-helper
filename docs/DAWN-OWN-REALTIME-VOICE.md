# 曙光自建即時語音（非 Gemini Live · 拒電音合成）

第二基地獨立測試頁：`app/dawn-own-voice-test.html`  
引擎：`app/dawn-own-voice.js` + `app/dawn-neural-tts.js`  
實驗室頁（非產品聲）：`app/dawn-voice-free.html`  
TTS stub（未部署／誠實 503）：`supabase/functions/dawn-own-tts`

## 方針

- **不用 Gemini Live**、不連 `technical-dark-star-live-voice-v2`、不把 `dawn-city-ai` WebSocket 當語音依賴。
- `dawn-city-ai` 目前上游是 Gemini Live，**不接線**。
- 不呼叫圖生影片／付費 Grok／Kling／Magic Hour。
- 不修改第一基地 `m9wmtcb782-arch/AIVAULT` 正式頁。
- 付費閘道 `_shared/paid_gate.ts` 必須遵守；預設禁止。

## 產品音色政策（2026-10-24）

| 項目 | 狀態 |
|------|------|
| 瀏覽器 `speechSynthesis` 當產品聲 | **REJECTED** |
| 產品播音 | **MUTED** 直到認可路徑就緒 |
| `dawn-natural-female-v2.wav` | **MISSING**（倉庫／信件／附件均無；測試頁可 IndexedDB 投放） |
| Qwen3-TTS／CosyVoice | **BLOCKED_NEED_GPU**（施工機無 GPU、無 torch） |
| 產品標 AVAILABLE | **禁止**，直到聽感驗收通過 |

## MVP 管線（本輪）

1. **麥克風** → `getUserMedia`；結束／離頁釋放。
2. **VAD／EOT** → 客戶端能量偵測；靜音 **700ms**（規格 500–800，見 `learn-gemini-live-voice.md`）。
3. **STT** → Web Speech API **僅辨識**（誠實標示）；不支援則打字。
4. **對話** → `?mock=1` 本機 MOCK；否則第二基地 `aivault-brain-gateway`（需登入）。失敗回**明確錯誤**，不偷偷轉付費、不默默 MOCK 冒充成功（AUTO 無登入 → `ERROR_NO_AUTH`）。
5. **TTS** → `DawnNeuralTts`：無 wav → `MUTED_WAITING_WAV`；有 wav 無 GPU → `BLOCKED_NEED_GPU`；**永不**用瀏覽器合成當產品聲。
6. **插話** → 停播 + flush PCM 佇列 + AbortController 取消 generati。
7. **字幕／重連／釋放 mic** → 有。
8. **wav 投放** → 拖放進測試頁 → IndexedDB；預覽參考；清除本機投放。

可選資產：`app/assets/dawn-voice/aivault-eot-v1-int8.onnx`（主城 EOT v1 int8，供未來 WASM EOT；本輪能量 VAD 已可測）。

## 關閉開關

- `?voice=0` / `localStorage.DAWN_OWN_VOICE_OFF=1`
- 除錯電音：`?synth=1`（REJECTED）
- MOCK：`?mock=1`；DEMO：`?mock=1&demo=1`

## 驗收邊界

- ✅ 可測：mic、VAD 能量條、EOT 計數、字幕、插話、重連、釋放、wav 投放校驗（RIFF）
- ❌ 未宣稱：產品自然女聲已接通、iPhone Safari 成功、AVAILABLE
- ❌ mock ≠ 真實模型；字幕 ≠ 產品播音

## 下一步（需使用者）

1. 提供 `dawn-natural-female-v2.wav`（聊天上傳或放入倉庫）。
2. 核准免費 GPU／自架主機跑 Qwen3-TTS 或 CosyVoice。
3. 部署 `dawn-own-tts` 並接上游後，聽感通過才可標 AVAILABLE。
4. 合併本草稿 PR 前再聽感／流程確認。
