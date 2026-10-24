# 曙光神經克隆部署計畫（Colab 免費 GPU 解鎖樣品）

**日期：** 2026-10-24 Asia/Taipei  
**使用者決策（t314）：** 下一步 = **Google Colab 免費 GPU**（T4），**不是** Gemini Live。  
**說話錨點：** `app/assets/dawn-voice/dawn-natural-female-v3-speak.wav`  
**SHA-256：** `c42a877c6af9cb48384e4b9a8bf3d24aac137107faf49d5201955df69398cf1d`  
**產品狀態（權威一字）：** `SPEAK: REFERENCE_TARGET_READY(v3) · NEURAL: BLOCKED_NEED_GPU · NOT AVAILABLE`

機器可讀：`NEURAL-CLONE-DEPLOY-PLAN.json`  
操作手冊：`scripts/dawn-neural-clone/COLAB-RUNBOOK.zh-TW.md`  
Notebook：`scripts/dawn-neural-clone/dawn-v3-colab-qwen3-tts.ipynb`

---

## 0. 立刻要做（已核准）：Colab 免費 T4

| 步驟 | 動作 |
|------|------|
| 1 | 你本人 **Google 登入** Colab |
| 2 | 上傳／打開 `dawn-v3-colab-qwen3-tts.ipynb` |
| 3 | **Runtime → GPU（T4）** |
| 4 | 上傳 `dawn-natural-female-v3-speak.wav` |
| 5 | 跑格：安裝 Qwen3-TTS → 克隆 **2–3 句**國語 → 下載 zip |
| 6 | 人工聽感（抑揚頓挫／非電音）；**通過前禁止 AVAILABLE** |
| 7 | 把 zip 交回 → `reports/dawn-voice/neural-poc/colab-out/` |

**引擎（Colab 首選）：** [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) **12Hz-0.6B-Base**（Apache-2.0；T4 友善；可改 1.7B）。  
**備選：** CosyVoice2 / Fun-CosyVoice3-0.5B（Apache-2.0；instruct 強；VRAM 較緊）。  
**授權注意：** 保留上游 Apache-2.0 聲明；不呼叫付費 API。

**Colab 定位：** 只為**解鎖克隆樣品**。免費額度／斷線／排隊都正常。  
**日常產品推論：** 聽感通過後仍需本機或自架 GPU 跑 `app/services/aivault-voice`（Colab 不適合 7×24）。

詳見：`COLAB-RUNBOOK.zh-TW.md`。

---

## 1. 本施工箱現況

| 項目 | 狀態 |
|------|------|
| NVIDIA GPU | **無**（`nvidia-smi` 不存在）→ **`BLOCKED_NEED_GPU`** |
| 說話 v3 | `REFERENCE_TARGET_READY` |
| v2 / 唱歌 ref | 保留 / Option B |
| 產品播音 | **MUTED** · **NOT AVAILABLE** |
| CPU OpenVoice 煙測 | 已跑出 wav（見 `neural-poc/`）→ **僅煙測，非產品** |

狀態機：`REFERENCE_TARGET_READY` → `BLOCKED_NEED_GPU` →（Colab 樣品 + 聽感 + 自架接線）→ `AVAILABLE`

---

## 2. 引擎排名

| 順位 | 引擎 | 授權 | Colab T4 | 產品角色 |
|------|------|------|----------|----------|
| **1** | **Qwen3-TTS 0.6B/1.7B-Base** | Apache-2.0 | ✅ 首選 notebook | 產品克隆主路徑（與 aivault-voice 同系） |
| **2** | CosyVoice2 / CosyVoice3-0.5B | Apache-2.0 | ⚠️ 可行較緊 | instruct／方言備選 |
| 3 | OpenVoice V1/V2 | MIT | 可 | **僅 PoC**；本箱 CPU 已煙測 |
| 禁止 | Gemini Live / Web Speech / 付費 API | — | — | 產品禁用 |

---

## 3. 硬體路線

| 階段 | 硬體 | 目的 |
|------|------|------|
| **現在（已選）** | Colab 免費 T4 | 克隆 2–3 句樣品、聽感 |
| 之後 | 本機 ≥8 GB NVIDIA 或自架 GPU | 日常產品推論 |
| 付費雲 | 需另批金額 | 預設不做 |
| AIVAULT 算力池 | 倉庫未文件化 | 不假設存在 |

---

## 4. 驗收（AVAILABLE 前門檻）

測試句已寫進 notebook。必須：音色像 v3、非電音、有抑揚頓挫、殘 BGM 不放大、接上 `DawnNeuralTts` 後才標 READY/AVAILABLE。

---

## 5. 本箱 CPU PoC（已完成 · 誠實）

- 引擎：OpenVoice V1 ZH · CPU  
- 輸出：`neural-poc/poc-openvoice-v1-zh-from-v3.wav`  
- 結論：能出聲 ≠ 產品可用；**仍 BLOCKED_NEED_GPU**；解鎖改走 Colab。  
- 報告：`neural-poc/POC-REPORT.md`

---

## 6. 產物路徑

| 產物 | 路徑 |
|------|------|
| 本計畫 | `/workspace/reports/dawn-voice/NEURAL-CLONE-DEPLOY-PLAN.md` |
| JSON | `/workspace/reports/dawn-voice/NEURAL-CLONE-DEPLOY-PLAN.json` |
| Notebook | `scripts/dawn-neural-clone/dawn-v3-colab-qwen3-tts.ipynb` |
| 手冊 | `scripts/dawn-neural-clone/COLAB-RUNBOOK.zh-TW.md` |
| PoC | `/workspace/reports/dawn-voice/neural-poc/` |
