# 曙光神經克隆聽感驗收（Colab Qwen3-TTS · v3）

**驗收時間：** 2026-10-24 Asia/Taipei  
**使用者回覆（權威 t324u）：** 「很好」→ **EAR_CHECK = PASS**  
**機器可讀：** `docs/evidence/dawn-voice-neural-poc/colab-qwen3-v3-ear-check.json`

---

## 一句狀態（權威 · 禁止改寫成 AVAILABLE）

`SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`

---

## 樣品

| 檔名 | 角色 | 約時長 | SHA-256 |
|------|------|--------|---------|
| `dawn-v3-qwen3-01-greeting.wav` | 問候 | 4.32 s | `0735009d9006833511e17e315d4071f129b681198d41cc40c14a73f5ddf333b9` |
| `dawn-v3-qwen3-02-question.wav` | 疑問 | 3.52 s | `4235d49f26c70d12167112ad4aad8734f79897a5da8b353b773cb06eb115dd41` |
| `dawn-v3-qwen3-03-calm.wav` | 平穩 | 6.08 s | `338ae80828d566a11a93d2b69f057962afffae7cf7a28fc9893c02cfe4f1f9fc` |

**路徑：**
- 資產：`app/assets/dawn-voice/colab-qwen3-v3-candidates/`
- 證據鏡像：`docs/evidence/dawn-voice-neural-poc/colab-qwen3-v3-candidates/`
- 報告鏡像：`/workspace/reports/dawn-voice/neural-poc/colab-qwen3-v3-candidates/`
- 使用者上傳 zip 來源：`/workspace/reports/dawn-voice/neural-poc/colab-user-zip/`

**格式：** 24 kHz mono PCM s16

---

## 引擎／參考

| 項目 | 值 |
|------|-----|
| 引擎 | **Qwen3-TTS**（Colab 免費 **T4**） |
| 授權 | Apache-2.0（上游保留） |
| 說話參考 | `dawn-natural-female-v3-speak.wav`（Max Factor VO · Demucs） |
| 使用者決策路徑 | t314 `colab_free_gpu` → t324u ear PASS |
| Gemini Live | **禁止**當產品聲 |
| 付費 API | **禁止** |

---

## 解鎖了什麼／還沒解鎖什麼

| 已解鎖 | 尚未 |
|--------|------|
| Colab 克隆樣品產出 | 產品即時 LIVE TTS |
| 使用者聽感 PASS（樣品） | 施工箱／7×24 GPU 主機 |
| 可當說話候選音檔入庫 | `AVAILABLE` 標籤 |
| 下一步可排 `aivault-voice` 自架推論 | 瀏覽器電音合成當產品聲（仍 REJECTED） |

**下一步（唯一）：** 自架／本機 GPU 跑 `app/services/aivault-voice`（或同等 Qwen3-TTS 推論主機）接 `DawnNeuralTts`。Colab 只解鎖樣品，不適合產品 7×24。

**禁止：** 因本 PASS 標 `AVAILABLE`；接 Gemini Live；用 `speechSynthesis` 冒充產品聲。
