# Dawn GPU host scaffold（LIVE TTS · 非 Colab）

**狀態：** stub only · 本施工箱無 CUDA → health 必須回 `BLOCKED_NEED_GPU` · **NOT AVAILABLE**

完整計畫：`docs/GPU-LIVE-TTS-HOST-PLAN.md`（報告：`/workspace/reports/dawn-voice/GPU-LIVE-TTS-HOST-PLAN.md`）  
真正推論實作：`app/services/aivault-voice/engine.py`（Qwen3-TTS）  
說話參考：`app/assets/dawn-voice/dawn-natural-female-v3-speak.wav`

## 這目錄是什麼

給**有 NVIDIA GPU 的機器**用的啟動草圖：

| 檔案 | 用途 |
|------|------|
| `docker-compose.yml` | GPU 服務草圖（需 NVIDIA Container Toolkit） |
| `.env.example` | token／埠／資料目錄（複製成 `.env`，勿提交密鑰） |
| `health_stub.py` | **無 CUDA 時**本地可跑的誠實 health（回 BLOCKED） |
| `Dockerfile` | 佔位；正式映像應安裝 CUDA PyTorch + qwen-tts |

Colab 免費 GPU：**只做樣品**，不要拿來當本 compose 的常駐 LIVE。

## 無 GPU（本箱／筆電）

```bash
cd scripts/dawn-neural-clone/gpu-host
python3 health_stub.py
# → GET http://127.0.0.1:8090/health  JSON status=BLOCKED_NEED_GPU
```

## 有 GPU 主機（選項 A）

1. 安裝 NVIDIA 驅動 + Container Toolkit（或直接 venv + CUDA PyTorch）。
2. 複製參考音到 `voice-data/dawn-natural-female-v3-speak.wav`。
3. `cp .env.example .env` · 設 `AIVAULT_VOICE_TOKEN`（≥24 字元）。
4. 優先跑既有服務：

```bash
cd app/services/aivault-voice
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
# 準備 dawn_v3 參考（見 engine.py / profiles；或把 v3 wav 掛進 data-dir）
python engine.py serve --data-dir ./voice-data --host 0.0.0.0 --port 8090
```

5. `GET /health` 僅在模型載入成功時 `ready: true`。
6. 接 `DawnNeuralTts`／`dawn-own-tts` 上游 → **LIVE 聽感** → 過關前禁止 AVAILABLE。

`docker compose up` 在無 GPU 機器上**不應**變成假 ready；compose 預設注解 GPU，需人工打開。

## 禁止

- Gemini Live／瀏覽器 speechSynthesis 當產品聲  
- 無 CUDA 回 `available: true`／`ready: true`  
- 未核准付費雲 API  
