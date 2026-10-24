# 曙光神經克隆部署計畫（Colab 樣品已解鎖 · LIVE 仍需 GPU 主機）

**日期：** 2026-10-24 Asia/Taipei  
**使用者決策（t314）：** Google Colab 免費 GPU（T4），**不是** Gemini Live。  
**聽感（t324u）：** 「很好」→ **SPEAK_CANDIDATES_EAR_OK**  
**說話錨點：** `app/assets/dawn-voice/dawn-natural-female-v3-speak.wav`  
**SHA-256：** `c42a877c6af9cb48384e4b9a8bf3d24aac137107faf49d5201955df69398cf1d`  
**產品狀態（權威一字）：** `SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`

機器可讀：`NEURAL-CLONE-DEPLOY-PLAN.json`（reports）／本目錄證據 JSON  
聽感報告：`docs/DAWN-NEURAL-CLONE-EAR-CHECK.md`  
操作手冊：`scripts/dawn-neural-clone/COLAB-RUNBOOK.zh-TW.md`  
Notebook：`scripts/dawn-neural-clone/dawn-v3-colab-qwen3-tts.ipynb`

---

## 0. Colab 解鎖（已完成）

| 步驟 | 狀態 |
|------|------|
| Google 登入 Colab · Runtime GPU T4 | ✅ 使用者完成 |
| Qwen3-TTS 克隆 v3 → 3 句國語 | ✅ |
| 下載 zip · 入庫 candidates | ✅ `app/assets/dawn-voice/colab-qwen3-v3-candidates/` |
| 人工聽感 | ✅ t324u 「很好」= PASS |
| 標 AVAILABLE | ❌ **禁止**（樣品 ≠ LIVE） |

**引擎：** Qwen3-TTS（Apache-2.0）· Colab 免費 T4。  
**Colab 定位：** 只解鎖克隆樣品。  
**日常產品推論：** 下一步 = 本機或自架 GPU 跑 `app/services/aivault-voice`。

---

## 1. 本施工箱現況

| 項目 | 狀態 |
|------|------|
| NVIDIA GPU | **無** → LIVE TTS **`BLOCKED_NEED_GPU_HOST`** |
| 說話 v3 | `REFERENCE_TARGET_READY` |
| Colab 樣品 | `SPEAK_CANDIDATES_EAR_OK` |
| 產品播音 | **MUTED** · **NOT AVAILABLE** |
| CPU OpenVoice 煙測 | 僅煙測，非產品 |

狀態機：`REFERENCE_TARGET_READY` → `COLAB_SAMPLES` → **`SPEAK_CANDIDATES_EAR_OK`** →（自架 GPU + LIVE 接線）→ `AVAILABLE`

---

## 2. 引擎排名

| 順位 | 引擎 | 授權 | 角色 |
|------|------|------|------|
| **1** | **Qwen3-TTS 0.6B/1.7B-Base** | Apache-2.0 | Colab 樣品已跑通；產品推論主路徑 |
| **2** | CosyVoice2 / CosyVoice3-0.5B | Apache-2.0 | instruct／方言備選 |
| 3 | OpenVoice V1/V2 | MIT | **僅 PoC** |
| 禁止 | Gemini Live / Web Speech / 付費 API | — | 產品禁用 |

---

## 3. 硬體路線

| 階段 | 硬體 | 狀態 |
|------|------|------|
| Colab 免費 T4 | 克隆樣品、聽感 | **DONE** |
| **現在下一步** | 本機 ≥8 GB NVIDIA 或自架 GPU（`aivault-voice`） | **待排** |
| 付費雲 | 需另批金額 | 預設不做 |

---

## 4. 驗收

- ✅ 樣品聽感 PASS（t324u）
- ❌ LIVE TTS／AVAILABLE：需自架 GPU 推論主機接 `DawnNeuralTts` 後另驗

---

## 5. 本箱 CPU PoC（歷史 · 誠實）

OpenVoice V1 ZH · CPU → 煙測 only。解鎖已改走 Colab（完成）。

---

## 6. 產物路徑

| 產物 | 路徑 |
|------|------|
| 聽感報告 | `docs/DAWN-NEURAL-CLONE-EAR-CHECK.md` |
| 聽感 JSON | `docs/evidence/dawn-voice-neural-poc/colab-qwen3-v3-ear-check.json` |
| 樣品 wav | `app/assets/dawn-voice/colab-qwen3-v3-candidates/` |
| Notebook／手冊 | `scripts/dawn-neural-clone/` |
| 報告鏡像 | `/workspace/reports/dawn-voice/` |
