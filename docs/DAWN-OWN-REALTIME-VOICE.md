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

## 產品音色政策（2026-10-24 · Option B · Colab 聽感後）

**一句狀態：** `SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`

| 項目 | 狀態 |
|------|------|
| 瀏覽器 `speechSynthesis` 當產品聲 | **REJECTED** |
| 產品即時播音（LIVE TTS） | **MUTED**／**BLOCKED_NEED_GPU_HOST**（需自架 GPU） |
| **`dawn-natural-female-v3-speak.wav`（說話 TARGET）** | **REFERENCE_TARGET_READY**（見 `DAWN-SPEAKING-V3.md`） |
| **Colab Qwen3-TTS 樣品**（`colab-qwen3-v3-candidates/`） | **SPEAK_CANDIDATES_EAR_OK**（t324u 「很好」· 見 `DAWN-NEURAL-CLONE-EAR-CHECK.md`） |
| **`dawn-natural-female-v2.wav`** | 早期說話錨點，**保留** |
| **`dawn-singing-melody-ref-v1.wav`** | **SINGING_MELODY_REF_READY** — 清唱／音律 ONLY（Option B） |
| 產品標 AVAILABLE | **禁止**（樣品 PASS ≠ LIVE TTS 已接通） |

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
- ✅ Colab Qwen3-TTS 樣品聽感 PASS（t324u）→ `SPEAK_CANDIDATES_EAR_OK`（非 LIVE）
- ❌ 未宣稱：產品即時自然女聲已接通、LIVE TTS、AVAILABLE
- ❌ mock ≠ 真實模型；字幕 ≠ 產品播音；樣品 PASS ≠ AVAILABLE

## 下一步

1. **（已完成）Colab 免費 T4** 克隆 v3 → 樣品入庫 → 使用者聽感 **PASS**（t324u）。見 `docs/DAWN-NEURAL-CLONE-EAR-CHECK.md`。
2. **（進行中）GPU LIVE 主機計畫** — 見 **`docs/GPU-LIVE-TTS-HOST-PLAN.md`**（報告：`GPU-LIVE-TTS-HOST-PLAN`）與骨架 **`scripts/dawn-neural-clone/gpu-host/`**。Colab **不適合**常駐即時；首選創辦人自有 NVIDIA PC（選項 A）。
3. **（下一個實作）** 有 GPU 後跑 `app/services/aivault-voice`（Qwen3-TTS）接 `DawnNeuralTts` — **LIVE TTS 仍 BLOCKED_NEED_GPU_HOST**。
4. 唱歌／音律：`dawn-singing-melody-ref-v1.wav`（Option B，非說話）。
5. LIVE 接線＋產品聽感前 **禁止** 標 AVAILABLE。

## 神經克隆進度（2026-10-24 · Colab 解鎖完成）

| 階段 | 狀態 |
|------|------|
| Colab T4 · Qwen3-TTS 樣品 | **DONE** · EAR_OK |
| 樣品路徑 | `app/assets/dawn-voice/colab-qwen3-v3-candidates/` |
| 聽感證據 | `docs/DAWN-NEURAL-CLONE-EAR-CHECK.md` + `docs/evidence/dawn-voice-neural-poc/colab-qwen3-v3-ear-check.json` |
| 操作手冊／Notebook | `scripts/dawn-neural-clone/` |
| 完整計畫 | `docs/NEURAL-CLONE-DEPLOY-PLAN.md` |
| LIVE 產品推論 | **BLOCKED_NEED_GPU_HOST**（計畫：`GPU-LIVE-TTS-HOST-PLAN.md` · 骨架：`scripts/dawn-neural-clone/gpu-host/` · 實作仍 = aivault-voice） |

**禁止：** Gemini Live 當產品聲；樣品 PASS 就標 `AVAILABLE`。  
本箱仍無 GPU；產品 **MUTED**／**NOT AVAILABLE**。
