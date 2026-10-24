# 曙光 LIVE TTS · GPU 主機計畫

**日期：** 2026-10-24 Asia/Taipei（約 14:44；Mac／雲補充同日稍晚）  
**決策來源：** 使用者選「plan_gpu_host」→ 後選 ABC（Mac 手冊 + 已合併 PR #36 + 付費雲後備筆記）  
**一句狀態：** `SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`  
**Mac 手冊：** `docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md`

機器可讀：同目錄 `GPU-LIVE-TTS-HOST-PLAN.json`  
倉庫鏡像：`docs/GPU-LIVE-TTS-HOST-PLAN.md` · Mac：`docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md` · 骨架：`scripts/dawn-neural-clone/gpu-host/`  
既有服務：`app/services/aivault-voice/`（Qwen3-TTS 部署程式，**尚未上線**）

---

## 0. 為什麼現在還不能「日常說話」

| 已完成 | 尚未完成 |
|--------|----------|
| v3 說話參考 wav | 常駐 GPU 推論主機 |
| Colab Qwen3-TTS 三句樣品 · 聽感「很好」 | 任意國語句即時合成 |
| 客戶端 mic／VAD／插話骨架 | `DawnNeuralTts` 接到真實上游 |
| | 產品標 `AVAILABLE`（**禁止假標**） |

**誠實結論：** 免費 Colab 只適合**批次克隆／聽感樣品**，不適合 7×24 即時對話。產品要 `AVAILABLE`，必須有一台**常駐、可 HTTPS 呼叫**的 GPU 主機。

本施工箱：**無 NVIDIA GPU** · `nvidia-smi` 不存在 · 不得假裝已接通。

---

## 1. 誰跑在哪裡（分工）

```
手機／瀏覽器（客戶端）          GPU 主機（伺服端）
─────────────────────          ──────────────────
麥克風 getUserMedia            Qwen3-TTS 模型權重
能量 VAD／EOT（約 700ms）      v3 克隆 prompt（固定參考）
STT（辨識 only）               POST /v1/audio/speech → WAV
對話文字（MOCK／brain）        GET /health（誠實狀態）
播 PCM／插話停播               Bearer token · 佇列 · 快取
字幕／開關                     永不跑在瀏覽器 speechSynthesis
```

- **Mic／VAD／插話停播** 留在客戶端（已有管線）。
- **TTS 推論** 只在 GPU 主機；瀏覽器只收 WAV／PCM 並播放。
- **禁止：** Gemini Live 當產品聲、瀏覽器 `speechSynthesis`、未核准付費 API。

---

## 2. 建議技術棧（與 Colab 同一引擎）

| 項目 | 選擇 |
|------|------|
| 引擎 | **Qwen3-TTS**（Apache-2.0）· 與 Colab notebook 同系 |
| 參考音 | `app/assets/dawn-voice/dawn-natural-female-v3-speak.wav` |
| SHA-256 | `c42a877c6af9cb48384e4b9a8bf3d24aac137107faf49d5201955df69398cf1d` |
| 部署程式 | `app/services/aivault-voice/engine.py`（既有） |
| 骨架／compose | `scripts/dawn-neural-clone/gpu-host/`（本輪新增 stub） |
| 客戶端 | `app/dawn-neural-tts.js` → 將來指到上游；無上游仍 `BLOCKED_NEED_GPU` |
| Edge stub | `supabase/functions/dawn-own-tts` · 無 GPU 時誠實 503 |

### 2.1 最低硬體（經驗區間 · 非本箱實測）

| 項目 | 建議 |
|------|------|
| GPU | NVIDIA **≥ 8 GB VRAM**（T4／RTX 3060 級可試 0.6B；1.7B 較穩） |
| 系統 RAM | ≥ 16 GB |
| 磁碟 | ≥ 20 GB（權重＋參考＋快取） |
| CUDA | 與所裝 PyTorch 相容；CPU 模式**僅離線評估**，不宣稱即時 |

Colab 免費 T4 已證明「能克隆出可聽樣品」；常駐主機沿用同模型家族，避免再換引擎。

### 2.2 API 形狀（對齊 aivault-voice／DawnNeuralTts）

**健康檢查（無 CUDA／未載入 → 不得回 ready／AVAILABLE）：**

```http
GET /health
Authorization: Bearer <AIVAULT_VOICE_TOKEN>
```

有 GPU 且模型就緒時示例：

```json
{
  "engine": "aivault-voice",
  "ready": true,
  "provider": "self_hosted",
  "voices": [{"id": "dawn_v3", "label": "曙光 v3"}]
}
```

無 CUDA 時骨架必須回（示例）：

```json
{
  "engine": "dawn-gpu-host-stub",
  "ready": false,
  "status": "BLOCKED_NEED_GPU",
  "product_tts": "NOT_AVAILABLE",
  "available": false
}
```

**合成：**

```http
POST /v1/audio/speech
Authorization: Bearer <AIVAULT_VOICE_TOKEN>
Content-Type: application/json

{"input":"完整國語原文。","voice":"dawn_v3","response_format":"wav"}
```

成功 → `audio/wav` bytes。失敗 → JSON + 非 2xx；**永不**用瀏覽器合成冒充成功。

`dawn-own-tts` Edge 可反向代理到此上游（`DAWN_OWN_TTS_UPSTREAM`）；未設上游維持 503 `BLOCKED_NEED_GPU`。

---

## 3. 主機選項排名

| 順位 | 選項 | 適不適合 LIVE | 說明 |
|------|------|---------------|------|
| **A（首選）** | **創辦人自己的 NVIDIA 電腦** | ✅ 適合常駐 | 零付費 API；家用／工作室 PC 裝 Docker 跑 `aivault-voice`；手機只當客戶端聽串流 |
| **A′** | **創辦人 Apple 筆電（MPS／CPU）** | ⚠️ **僅試作** | **無 CUDA**；M 系列可試 PyTorch **MPS**（Qwen3-TTS 不保證相容），否則 CPU（慢）。睡眠＝斷線，不當 7×24。手冊：`docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md` |
| **B** | **Colab 免費 GPU** | ❌ **不適合**日常 LIVE | 斷線、閒置回收、無法穩定 HTTPS 給產品；**只保留批次樣品／聽感**（已完成） |
| **C** | **便宜雲 GPU**（RunPod／Vast 等） | ⚠️ 需另批金額 | 見下方 **§3.C**；Phase A **預設拒絕付費**；**之後、要明文 $ 核准**才排；本輪不開帳、不存金鑰 |
| **D** | **AIVAULT compute pool** | ❌ **目前不存在可掛載池** | 倉庫僅有 `app/services/aivault-voice` **部署程式**，文件**未**描述已上線共用 GPU 池；不可假裝有池可接 |

**給「人在手機上」的創辦人一句話：**  
手機本身不用顯卡。你有 Apple 筆電 → 先跟 A′ 手冊試作流程；要穩定日常說話仍要 A（NVIDIA）或等你核准付費雲 C。在那之前產品維持 **NOT AVAILABLE**，可繼續播 Colab 樣品／參考 wav 預覽。

### 3.C 付費雲 GPU 後備（RunPod／Vast 等）· **之後才做**

> **預設：不做、不花錢、不存 API／SSH 金鑰。**  
> 僅在使用者**明文核准**：供應商、機型、**預算上限（$）**、計費方式之後，才另外開施工單。

| 項目 | 筆記（規劃用 · 非下單） |
|------|------------------------|
| 為何列後備 | Mac 試作／無家用 NVIDIA 時，雲 GPU 可當常駐推論；仍要自己接 `aivault-voice` + v3 參考 |
| 常見供應商（示例） | **RunPod**、**Vast.ai**、類似按小時租 NVIDIA（T4／RTX 等）的平台 |
| 建議規格起點 | 與 §2.1 相同：VRAM **≥ 8 GB**、磁碟 ≥ 20 GB、可裝 CUDA PyTorch |
| 接線概念 | 租到機器 → 裝驅動／Docker 或 venv → 跑 `gpu-host`／`engine.py` → HTTPS 反代 → Edge／`DawnNeuralTts` 指上游 |
| 費用風險 | 閒置未關機會持續計費；要設自動關機／預算警報（**核准後**再設） |
| 本輪禁止 | 註冊付費、綁卡、建立實例、把密鑰寫進倉庫或聊天 |
| 核准句型（範例） | 「核准用 RunPod RTX 3080，上限每月 USD __，超過就關」——缺金額與上限則**不排** |

**狀態標籤：** `CLOUD_GPU_BACKUP_DOCUMENTED · AWAITING_EXPLICIT_DOLLAR_APPROVAL`

---

## 4. Docker／Compose 草圖（骨架已落地）

見 `scripts/dawn-neural-clone/gpu-host/docker-compose.yml`（**stub**：無 GPU 時 health 回 `BLOCKED_NEED_GPU`，不標 AVAILABLE）。

概念：

```yaml
# 僅在有 NVIDIA Container Toolkit 的機器上 up
services:
  dawn-tts:
    build: .
    ports: ["8090:8090"]
    environment:
      - AIVAULT_VOICE_TOKEN=...   # ≥24 字元；勿提交 Git
      - AIVAULT_VOICE_DATA=/data
      - DAWN_SPEAK_REF=/data/dawn-natural-female-v3-speak.wav
    volumes:
      - ./voice-data:/data
    # deploy.resources.reservations.devices: nvidia gpu
```

真實推論仍以 `app/services/aivault-voice/engine.py` 為準；gpu-host 目錄先給 **README + compose stub + env 範例 + 無 CUDA 誠實 health**。

---

## 5. 接線步驟（有 GPU 主機之後）

1. 複製 v3 wav → 主機 `voice-data/`；準備 `dawn_v3` 克隆 prompt（或沿用 Colab 流程寫入固定參考）。
2. `engine.py prepare`／`serve`（或 compose up）· 確認 `GET /health` → `ready: true`。
3. 反代 HTTPS；token **不進前端**；Edge／後端持 token 轉發。
4. `DawnNeuralTts`／`dawn-own-tts` 指向上游；probe 從 `BLOCKED_NEED_GPU` 改為可合成。
5. **LIVE 聽感**：任意國語句、疑問／平穩、插話停播；過關前 **禁止** `AVAILABLE`。
6. 過關後才改產品狀態一字（另開變更，本計畫不擅自標 AVAILABLE）。

---

## 6. 驗收標準（LIVE）

| # | 條件 | 通過才算 |
|---|------|----------|
| 1 | 任意國語文字 → 以 **v3** 音色合成 WAV | 是 |
| 2 | 延遲目標（對話輪） | 首包／完整句 **理想 < 2–3 s**（未實測前只當目標） |
| 3 | 插話 | 客戶端停播 + 取消進行中請求；主機可忽略已取消請求 |
| 4 | 無 Gemini Live／無 speechSynthesis 產品路徑 | 是 |
| 5 | 無 CUDA／未部署 | health／TTS 回 `BLOCKED_NEED_GPU` · **available: false** |
| 6 | 標 `AVAILABLE` | **僅**在接線 + LIVE 聽感過關之後 |

Colab 樣品 PASS ≠ 本表通過。

---

## 7. 明確不做

- ~~不合併 PR #36~~ → **已合併**（`0cc8d68`）；文件／樣品已在 main
- 不把 Colab 閒置連線當產品 LIVE
- 不把 Mac MPS 試作標成產品 AVAILABLE
- 不呼叫付費 TTS／Gemini Live
- **不**在未明文核准金額時開 RunPod／Vast 等付費實例、不存雲端金鑰
- 不在本無 GPU 施工箱回 `ready: true` 或 `AVAILABLE`
- 不宣稱 AIVAULT 已有現成 GPU 算力池可掛

---

## 8. 下一步（建議順序）

1. **A′ Apple 筆電（已選）：** 依 `docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md` 設 `DAWN_DEVICE=mps|cpu`、跑 health stub、區網試作。  
2. **A NVIDIA：** 若之後有／能借 ≥8GB 顯卡電腦 → `gpu-host/README.md` 常駐。  
3. **C 付費雲：** 僅在明文核准供應商＋**$ 上限**後排；見 §3.C。未核准前不開機。  
4. 主機真實引擎 `health=ready` 且 LIVE 聽感過關後，再排 `DawnNeuralTts` 接線；**另開變更**才可討論 AVAILABLE。

**禁止：** 樣品好聽／Mac 試作成功就標產品已接通。
