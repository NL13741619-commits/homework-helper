# 曙光 LIVE TTS · Apple 筆電主機手冊（Mac）

**日期：** 2026-10-24 Asia/Taipei  
**給誰：** 創辦人有 Apple 筆電、還沒設定；要當「自己說話」的臨時主機  
**一句狀態：** `SPEAK_CANDIDATES_EAR_OK · LIVE_TTS BLOCKED_NEED_GPU_HOST · NOT AVAILABLE`  
**關聯：** `docs/GPU-LIVE-TTS-HOST-PLAN.md` · `scripts/dawn-neural-clone/gpu-host/README-MAC.zh-TW.md`

> **誠實標示：** 本手冊教你在 Mac 上**試跑**骨架／可能的 MPS 推論。  
> **不要**把產品標成 `AVAILABLE`。筆電睡眠＝主機斷線，不適合 7×24。

---

## 0. 先看這段（30 秒）

| 問題 | 答案 |
|------|------|
| Mac 有 NVIDIA CUDA 嗎？ | **沒有。** Apple 筆電跑的是 Apple Silicon（MPS）或 Intel CPU。 |
| 能當產品 LIVE 嗎？ | **頂多試作。** 睡眠、電池、過熱都會斷。常駐仍建議 NVIDIA PC 或（另核准後）雲 GPU。 |
| 手機要顯卡嗎？ | **不用。** 手機只當客戶端；Mac 當伺服端出聲。 |
| 聽感樣品過關＝已接通？ | **否。** Colab 三句 PASS ≠ 產品 AVAILABLE。 |

---

## 1. 先判斷你的 Mac 種類

打開「終端機」（Terminal），貼上下面整段，按 Enter：

```bash
uname -m
sysctl -n machdep.cpu.brand_string 2>/dev/null || true
python3 -c "import platform; print(platform.platform())" 2>/dev/null || true
```

| `uname -m` 結果 | 代表 | 推論裝置優先序 |
|-----------------|------|----------------|
| `arm64` | **Apple Silicon**（M1／M2／M3／M4） | 試 `mps` → 失敗再 `cpu` |
| `x86_64` | **Intel Mac** | 只有 `cpu`（很慢；不做產品 LIVE） |

一句話：

- **M 系列：** 有機會用 PyTorch **MPS** 加速（若 Qwen3-TTS／相依套件支援）。不保證；失敗就降 CPU 或改走雲／NVIDIA。  
- **Intel：** 幾乎只能 CPU，僅離線聽一句，不當日常說話。

---

## 2. 裝置誠實表（`DAWN_DEVICE`）

環境變數（見 `.env.example`）：

```bash
DAWN_DEVICE=mps   # Apple Silicon 優先試這個
# DAWN_DEVICE=cpu # 慢；僅評估
# DAWN_DEVICE=cuda # 只有 NVIDIA 主機才設；Mac 不要設
```

| 值 | 何時用 | 產品可用？ |
|----|--------|------------|
| `mps` | M1–M4 且 PyTorch 偵測到 MPS | **否**（試作中；聽感＋穩定過關前禁止 AVAILABLE） |
| `cpu` | Intel、或 MPS 失敗 | **否**（離線評估） |
| `cuda` | NVIDIA PC／雲 | 接線＋LIVE 聽感過關後才可討論 AVAILABLE |

骨架 `health_stub.py` 即使偵測到 MPS，也**仍回** `available: false`／`product_tts: NOT_AVAILABLE`（stub 不載權重）。

---

## 3. 一步一步（手機可讀 · 請用 Mac 終端機操作）

### 步驟 A ·（可選）裝 Homebrew

若還沒裝套件管理：

1. 開 [https://brew.sh](https://brew.sh) 依官網指令安裝  
2. 或略過，改用系統自帶 `python3`（macOS 通常已有）

```bash
brew --version   # 有版本號就 OK
```

### 步驟 B · 確認 Python

```bash
python3 --version   # 建議 3.10 以上
```

太舊再：`brew install python@3.11`

### 步驟 C · 取得倉庫

```bash
cd ~
git clone https://github.com/NL13741619-commits/homework-helper.git
cd homework-helper
git checkout main
git pull
```

（若你已有資料夾，改成 `cd` 進去再 `git pull`。）

### 步驟 D · 放好 v3 說話參考

倉庫內路徑（已合併）：

`app/assets/dawn-voice/dawn-natural-female-v3-speak.wav`

複製一份到 gpu-host 資料目錄：

```bash
mkdir -p scripts/dawn-neural-clone/gpu-host/voice-data
cp app/assets/dawn-voice/dawn-natural-female-v3-speak.wav \
  scripts/dawn-neural-clone/gpu-host/voice-data/
```

### 步驟 E · 環境變數

```bash
cd scripts/dawn-neural-clone/gpu-host
cp .env.example .env
```

用文字編輯器打開 `.env`，至少改：

```bash
AIVAULT_VOICE_TOKEN=請改成至少24字元的亂數
AIVAULT_VOICE_HOST=0.0.0.0
AIVAULT_VOICE_PORT=8090
DAWN_SPEAK_REF=/絕對路徑/.../voice-data/dawn-natural-female-v3-speak.wav
DAWN_DEVICE=mps
```

Intel Mac 請設 `DAWN_DEVICE=cpu`。

產生亂數 token 範例：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

### 步驟 F · 先跑誠實 health 骨架（必做）

```bash
cd scripts/dawn-neural-clone/gpu-host
# 載入 .env（若你的 shell 支援）
set -a && source .env && set +a
python3 health_stub.py
```

另開一個終端機視窗：

```bash
curl -s http://127.0.0.1:8090/health | python3 -m json.tool
```

**預期（Mac 試作）：**

- `available`: **false**  
- `product_tts`: **NOT_AVAILABLE**  
- `device`／`mps`／`cuda` 欄位誠實回報  
- **不會**出現產品已接通

若你設了 token，curl 要加：

```bash
curl -s -H "Authorization: Bearer 你的token" http://127.0.0.1:8090/health
```

### 步驟 G ·（進階）試跑真正引擎 · 合成一句

僅在你願意下載模型、且了解可能失敗時：

```bash
cd ~/homework-helper/app/services/aivault-voice
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
# Apple Silicon 另裝對應的 PyTorch（依 pytorch.org 選 macOS / pip）
# 然後：
export AIVAULT_VOICE_TOKEN=與上面相同
# 先 prepare（依 engine 文件／profiles；裝置改 mps 或 cpu）
python engine.py prepare --device mps --data-dir ../../scripts/dawn-neural-clone/gpu-host/voice-data
python engine.py serve --device mps --data-dir ../../scripts/dawn-neural-clone/gpu-host/voice-data \
  --host 0.0.0.0 --port 8090
```

**若出現不支援 MPS／CUDA 錯誤：**  
改 `--device cpu` 再試；仍失敗 → 記下來，改走 NVIDIA PC 或（核准後）雲 GPU。  
**不要**為了過關去接 Gemini Live。

合成一句（引擎就緒後）：

```bash
curl -s -X POST http://127.0.0.1:8090/v1/audio/speech \
  -H "Authorization: Bearer 你的token" \
  -H "Content-Type: application/json" \
  -d '{"input":"你好，我是曙光。","voice":"dawn_v3","response_format":"wav"}' \
  --output /tmp/dawn-mac-one.wav
afplay /tmp/dawn-mac-one.wav   # Mac 內建播放
```

骨架 stub 的 POST 會回 **503**（正常；stub 不做推論）。

### 步驟 H · 手機同一 Wi‑Fi 連到 Mac

1. Mac 與手機連**同一個 Wi‑Fi**（不要用訪客網路隔離）。  
2. 查 Mac 區網 IP：

```bash
ipconfig getifaddr en0    # 常見 Wi‑Fi
# 若空：
ipconfig getifaddr en1
```

得到例如 `192.168.1.23`。

3. 手機瀏覽器或 curl 測：

`http://192.168.1.23:8090/health`

4. **防火牆：**  
   系統設定 → 網路 → 防火牆 → 允許 `python3`／你的終端機接受傳入連線；或暫時測試時關閉（測完開回）。  
5. **勿**把 `0.0.0.0:8090` 暴露到公網；只給區網試作。正式產品要 HTTPS 反代，token 不進前端。

---

## 4. Apple 筆電的硬限制（必讀）

| 限制 | 影響 |
|------|------|
| **合蓋／睡眠** | 主機立刻斷；手機聽不到聲 |
| **非 7×24** | 不適合當正式 LIVE 伺服器 |
| **電池** | 推論耗電；請接電源 |
| **過熱降頻** | 連續對話可能變慢或失敗 |
| **無 CUDA** | 與 Colab／NVIDIA 路徑不同；MPS 相容性不保證 |
| **Docker GPU** | Mac Docker **沒有** NVIDIA runtime；本目錄 compose 以 NVIDIA 為主，Mac 請用本手冊 venv 路徑 |

---

## 5. 與計畫選項怎麼對上

| 計畫選項 | 你現在能做的 |
|----------|--------------|
| **A′ Mac 試作**（本手冊） | 區網試作、學流程、聽一句 |
| **A NVIDIA PC** | 仍是正式常駐首選 |
| **B Colab** | 樣品已完成；不當 LIVE |
| **C 付費雲** | 見 GPU 計畫 §3C；**要明文核准金額**才排；本輪不花錢、不存金鑰 |

---

## 6. 明確不做

- 不標產品 `AVAILABLE`  
- 不接 Gemini Live／瀏覽器 `speechSynthesis` 當產品聲  
- 不在未核准時開 RunPod／Vast 等付費實例  
- 不把 Mac 睡眠中的斷線說成「已上線」

---

## 7. 做完回報清單（給施工代理）

請回傳：

1. `uname -m` 結果（arm64 或 x86_64）  
2. `curl /health` 的 JSON（可遮 token）  
3. 若有合成：`/tmp/dawn-mac-one.wav` 是否播得出、像不像 v3  
4. MPS 成或敗（貼錯誤關鍵句即可）

狀態在 LIVE 聽感＋常駐方案過關前，維持：

**`NOT AVAILABLE` · `BLOCKED_NEED_GPU_HOST`（Mac 試作 ≠ 產品接通）**
