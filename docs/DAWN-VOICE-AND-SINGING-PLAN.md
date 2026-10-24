<!-- 2026-10-24: realtime speaking TARGET switched to dawn-realtime-target-v1.wav (video audio). v2 kept. Singing melody from same clip = separate track. Product TTS NOT AVAILABLE. -->
# 曙光說話＋唱歌統一計畫（第二基地）

**日期：** 2026-10-24（Asia/Taipei）  
**約束：** 不用 Gemini Live；不用付費 API；不用瀏覽器／DSP 電音當產品聲；自然參考路徑

## 1. 說話（即時語音）— 現況

| 項目 | 狀態 |
|------|------|
| `dawn-natural-female-v2.wav` | **REFERENCE_WAV_READY**（可預覽） |
| SHA-256 | `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce` |
| 參考韻律粗測 | F0 range ~278 Hz、CV ~0.22 → **非死平** |
| 產品即時 TTS | **BLOCKED_NEED_GPU**（Qwen3-TTS／CosyVoice instruct／emotion） |
| 抑揚頓挫規格 | `docs/DAWN-VOICE-PROSODY-SPEC.md` |
| 測試頁 | `app/dawn-own-voice-test.html` |

## 2. 唱歌 — GPT 昨日施工盤點（Issues #22–#24）

### 施工單（OPEN）

| Issue | 標題要旨 | 要求 |
|-------|----------|------|
| **#22** | 小太陽短句唱歌 | 不可只念歌詞；要音高／時值；baseline 朗讀 vs 真唱 |
| **#23** | 指定歌曲→旋律→對齊→演唱 | 合法素材；F0／BPM；JSON；不可 TTS 冒充 |
| **#24** | 正式 P0 研發單 | 搜尋→辨識→對齊→歌聲；原創四小節里程碑 |

### 已存在（main／合併）

| 資產 | 狀態 | 誠實標籤 |
|------|------|----------|
| `app/dawn-music-free.html` + `app/dawn-free/melody-sing.js` | 有 | **EXPERIMENTAL_DSP_SINGING** — Web Audio 振盪器，**非產品歌唱** |
| PR **#27**（已合併） | 免費媒體包 | 歌唱頁明確標非產品聲 |

### 草稿未合併（local-ai 路線）

| PR | 內容 | 注意 |
|----|------|------|
| **#21** draft | 本機 Qwen 聊天 + 四小節歌唱原型、`audio_engine.py`、音高驗證 | 需本機／GPU 節點；未進 main |
| **#25** draft | 旋律分析、歌詞對齊、押韻、`melody.py`／`song_search.py` | 同上；合法搜尋仍受限 |

### 明顯缺口（產品「說話能唱歌」）

1. **自然歌聲合成器**：用認可女聲／小太陽聲線 + 音高條件，不是 sine DSP  
2. **說話↔唱歌同一會話路由**（chat TTS vs sing route）— Gateway 尚未接  
3. **神經歌唱模型權重**與 GPU 主機  
4. Issue #22 要求的 baseline／真唱音檔驗收證據（DSP 頁不算 PASS）  
5. 商業歌曲授權管線（#23/#24 P1+）— 先做原創四小節

## 3. 統一架構（目標）

```
使用者：「說一句」→ 神經 TTS（抑揚頓挫／emotion）→ 播放
使用者：「唱兩句／唱某首（合法）」→ sing intent
    →（可選）旋律 JSON（MIDI／分析）
    → 自然歌聲模型（參考 wav 條件／克隆）→ WAV
    → 字幕／嘴型；可取消；回到對話
禁止：Gemini Live、付費 API、DSP／Web Speech 冒充產品唱／說
```

## 4. 下一步（建議順序）

1. **說話：** GPU 上部署 Qwen3-TTS／CosyVoice，克隆 `dawn-natural-female-v2.wav`，驗抑揚頓挫 → 才標 AVAILABLE  
2. **唱歌 P0：** 在同一自然聲線上做 4 小節原創唱（音高可控）；評 F0 對旋律；DSP 僅留實驗  
3. 審核是否合併／移植 PR #21／#25 的 `local-ai` 旋律工具（仍標清授權與硬體）  
4. 小太陽聊天接 sing intent（不接 Gemini Live）

## 5. 狀態標籤（對外）

| 能力 | 標籤 |
|------|------|
| 參考女聲預覽 | REFERENCE_WAV_READY |
| 產品說話 | 非 AVAILABLE · BLOCKED_NEED_GPU |
| DSP 唱歌實驗 | EXPERIMENTAL_DSP_SINGING · 非產品 |
| 產品唱歌 | NOT_AVAILABLE（待自然歌聲路徑） |
