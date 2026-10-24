# Dawn TTS 主機 · Apple Mac 快速說明

完整逐步手冊（繁中）：[`docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md`](../../../docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md)

## 一句話

Mac **沒有 NVIDIA CUDA**。Apple Silicon 可試 `DAWN_DEVICE=mps`；不行就 `cpu`（慢）。**禁止**標產品 AVAILABLE。

## 環境變數

```bash
DAWN_DEVICE=mps   # M1/M2/M3/M4 優先
# DAWN_DEVICE=cpu
# DAWN_DEVICE=cuda  # 僅 NVIDIA；Mac 勿設
```

見 `.env.example`。

## 最小指令

```bash
cd scripts/dawn-neural-clone/gpu-host
cp .env.example .env   # 編輯 token、DAWN_DEVICE
set -a && source .env && set +a
python3 health_stub.py
# 另窗：curl -s http://127.0.0.1:8090/health
```

Health 即使偵測到 MPS，stub 仍回 `available: false`。

## Docker

本目錄 `docker-compose.yml` 面向 **NVIDIA Container Toolkit**。  
Mac 請用 venv + 本 README／繁中手冊，不要期待 compose 出現 CUDA GPU。

## 限制

睡眠斷線 · 非常駐 · 電池／過熱 · MPS 不保證相容 Qwen3-TTS。
