# 曙光唱歌模組交接狀態（ChatGPT → Grok Bot）

**日期：** 2026-10-24 13:22（Asia/Taipei）  
**倉庫：** `NL13741619-commits/homework-helper`（僅第二基地）  
**政策：** 無付費 API、無 Gemini Live、瀏覽器合成非產品聲；`dawn-natural-female-v2.wav` = **參考錄音 only**，不證明歌唱／即時語音已上線。

三層狀態標籤（全文統一）：
- **本地可執行** / **後端已部署** / **網站已接通**
- 能力細項：`已實作並實測` / `只有原型` / `尚未完成`

---

## 0. 一句話結論

**網站歌唱尚未接通。** 本機可重現 PR #21 英文四小節 DSP 歌唱（9.6s）與 PR #25 旋律測試（15/15）。中文女聲清唱僅有「參考 wav + WORLD 音高變形」DSP 試聽，**咬字不合格、非神經唱、非產品 AVAILABLE**。完整歌曲（前奏＋伴奏）分析管線 **尚未完成**；昨日「8 音符／120.27 BPM」僅為受控單旋律基準，**不是通用規則**。

| 層 | 狀態 |
|----|------|
| 本地可執行 | **部分 YES**（`local-ai` 在草稿分支；本機已重跑） |
| 後端已部署 | **NO**（無常駐歌唱 Edge／GPU TTS） |
| 網站已接通 | **NO**（Pages 僅有 DSP／REFERENCE_PLAYBACK 演示；產品唱 NOT AVAILABLE） |

---

## 1. 程式與 PR 盤點

| 項目 | 位置 | 合併 | 誠實狀態 |
|------|------|------|----------|
| PR **#21** | 分支 `feat/dawn-local-chat-sing` @ `6e05b42`；核心 `local-ai/audio_engine.py`（Flite EN + WORLD） | **DRAFT 未合併** | 本地可執行＝**已實作並實測**（本輪重跑）；網站＝尚未接通 |
| PR **#25** | 分支 `feat/dawn-melody-lyrics` @ `114a096`；`local-ai/melody.py`、`song_search.py`、`MELODY.md` | **DRAFT 未合併**（base=#21） | 單旋律／清唱分析＝**已實作並實測**（15/15）；完整混音＝尚未完成 |
| PR **#26** | `feat/dawn-live-local-voice` | DRAFT | 本機 Whisper→Qwen→Kokoro 串接語音；非歌唱產品 |
| Issue **#22/#23/#24** | 歌唱教學／聽歌學唱 P0 | OPEN | 產品需求；未完成驗收 |
| main Pages | `app/dawn-music-free.html` + `melody-sing.js` | MERGED (#27) | **只有原型** EXPERIMENTAL_DSP（振盪器） |
| main Pages | `app/dawn-sing-ref.html` | MERGED (#32) | **只有原型** REFERENCE_PLAYBACK |
| main | `app/assets/dawn-voice/dawn-natural-female-v2.wav` | MERGED (#32/#31) | REFERENCE_WAV_READY；**非歌唱證明** |
| PR **#31** | 自建語音 MVP harden | **已合併** `caa3f12`（2026-10-24 05:21Z） | 說話管線強化；產品 TTS 仍 MUTED／BLOCKED_NEED_GPU |

### PR #21「15 項」澄清
- **#21 本體測試是 8 項**（本輪 `python3 -m unittest` → 8/8 OK）。
- **#25 宣稱 15/15**＝原 8 項 + 旋律 7 項；本輪在 `feat/dawn-melody-lyrics` 抽出碼上 **Ran 15 tests … OK**。
- 測試涵蓋：授權／限流／取消／MIDI 頭／真實合成音高、**已知 8 音單旋律**辨識、BPM 候選、8 字配詞提案、押韻分組、混音拒絕冒充單旋律、靜音不造假音高。  
- **不含：** 商業全曲、人聲分離、前奏／副歌分段、拍號漂移、中文歌聲合成、iPhone、網站 E2E。

### 先前宣稱核對（本輪重跑）

| 宣稱 | 本輪結果 |
|------|----------|
| ~9.6s 四小節英文人聲＋伴奏＋MIDI | **確認** `duration_seconds=9.6`；產物見下 |
| 音高接近目標 | **確認** 16 音符 median cents 約 **0.63–4.69**（中位 ~1.68） |
| 8 音符辨識 + ~120.27 BPM | **屬 #25 受控波形證據**（`pr25-evidence/melody-benchmark.json`）；**不可當通用規則** |
| 8 字歌詞對齊 | **#25 提案對齊**（非 forced alignment 到錄音） |

---

## 2. 本輪可播放產物（本地）

目錄：`/workspace/reports/dawn-singing/`（副本 `docs/evidence/dawn-singing/`）

### 2.1 英文短歌重跑（PR #21 引擎）— **已實作並實測**

```bash
# 命令（本機，無外部 AI API）
cd /tmp/dawn-local-ai/local-ai   # 自 origin/feat/dawn-local-chat-sing archive
. /workspace/reports/dawn-singing/.venv/bin/activate
python3 -c 'from audio_engine import sing; ...'  # 見 rerun-english-result.json
python3 -m unittest discover -s tests -v   # 8/8
```

| 檔案 | 說明 |
|------|------|
| `rerun-english-vocal.wav` | 人聲 |
| `rerun-english-backing.wav` | 伴奏 |
| `rerun-english-mix.wav` | 混音 |
| `rerun-english-melody.mid` | MIDI |
| `rerun-english-result.json` | 時間軸、引擎、耗時 **1.638s** |
| `rerun-english-pitch.json` | 逐音 F0 |

- **引擎：** `dawn-score-world-v1` / `flite-slt-en`  
- **狀態標籤：** `EXPERIMENTAL_DSP_SINGING`；`trained_singing_model=false`  
- **本地可執行：YES**　**後端已部署：NO**　**網站已接通：NO**

### 2.2 中文女聲清唱試聽 — **只有原型（DSP）**

| 檔案 | 說明 |
|------|------|
| `zh-female-acapella-dsp.wav` | ~6.05s；原創詞「小太陽亮晶晶陪我看星星」 |
| `zh-female-acapella-report.json` | 評分與免責 |

- **做法：** 以 `dawn-natural-female-v2.wav` 為 grain，WORLD 改寫到指定 MIDI（**非**神經克隆、**非**中文音素）。  
- **音高：** 逐音 median cents_error 中位 ~9.3（受控旋律）。  
- **咬字：** **FAIL** — 聽不出清晰中文字。  
- **自然度：** PARTIAL（有參考音色，但拼接／聲碼器感）。  
- **神經 TTS／歌唱：** **BLOCKED_NEED_GPU**  
- **本地可執行：YES（DSP）**　**後端：NO**　**網站：NO**

---

## 3. ChatGPT 完整歌曲分析驗收清單（誠實標記）

> 歌唱 ≠ 文字→調音高。必須能理解含前奏／伴奏的完整歌曲結構。  
> **禁止**把「8 音符／120.27 BPM」當通用規則。

| 能力 | 狀態 | 證據／路徑 | 說明 |
|------|------|------------|------|
| 語言／歌詞辨識（ASR） | **尚未完成** | — | #25 明確 NOT；需使用者提供或合法歌詞 |
| 旋律輪廓（逐音序列，非平均音高） | **只有原型** | `melody.py`；`pr25-evidence/melody-benchmark.json` | 受控單旋律／已分離清唱 OK；全曲未測 |
| 節奏／速度／拍點漂移（非單一 BPM） | **只有原型** | BPM + 半速／雙速候選；`meter=NOT_INFERRED` | 無變速／拍號推論 |
| 長短音、換氣、句讀 | **尚未完成** | — | timeline 有 note duration；無 breath 模型 |
| 歌詞↔旋律對齊（1:1、1:多、同音多字、延音尾） | **只有原型** | DP 配詞提案；melisma flag | **非**錄音 forced alignment |
| 押韻輔助（僅輔助，不發明歌詞） | **只有原型** | 句尾拼音韻母分組 | 不改使用者歌詞 |
| 分段（前奏／主歌／副歌／間奏；多首歌切開） | **尚未完成** | — | |
| 音源分離（人聲／鼓／貝斯／其他） | **尚未完成** | full_mix → `NEEDS_MELODY_SOURCE_SEPARATION` | 誠實拒絕，未實作分離 |
| 分節人工對照驗收流程 | **尚未完成** | — | |
| 聽感音質驗收（人耳） | **尚未完成** | 英文有客觀 F0；中文 DSP 未人工 PASS | |
| 說話→哼唱／清唱→說話 + 插話取消 | **尚未完成（產品）** | 說話側：own-voice 有 barge-in 原型；唱路由未接 | 見 §5 |

---

## 4. 網站／後端現況（勿虛報上線）

**Live URLs（HTTP 200，但能力標籤如下）：**

- 媒體中心：https://nl13741619-commits.github.io/homework-helper/media.html  
- 自建語音測試：https://nl13741619-commits.github.io/homework-helper/app/dawn-own-voice-test.html — 產品 TTS **MUTED／BLOCKED_NEED_GPU**  
- 參考唱演示：https://nl13741619-commits.github.io/homework-helper/app/dawn-sing-ref.html — **REFERENCE_PLAYBACK**  
- DSP 音樂：https://nl13741619-commits.github.io/homework-helper/app/dawn-music-free.html — **EXPERIMENTAL_DSP**  
- 參考 wav：https://nl13741619-commits.github.io/homework-helper/app/assets/dawn-voice/dawn-natural-female-v2.wav — **REFERENCE only**

**PR #31** 已合併（`caa3f12`）；Pages last-modified ≈ 05:21Z。  
**未部署：** `local-ai` HTTP 主機、歌唱 Edge Function、神經 TTS/Sing GPU。

---

## 5. 說 ↔ 唱整合計畫（短版；不強迫合併 #21/#25）

詳見已合併：`docs/DAWN-SPEAK-SING-INTEGRATION-PLAN.md`。

| 步驟 | 內容 | 依賴 |
|------|------|------|
| A | 共用 `voice_id=dawn-natural-female-v2` | wav 已入庫 |
| B | `dawn-own-voice`：intent=`chat`→神經 TTS；intent=`sing`/`hum`→歌唱管線 | GPU／免費神經引擎 |
| C | 同一播放佇列：插話 → flush speak **與** sing | own-voice AbortController 可延伸 |
| D | 字幕／狀態機：listening → speaking ↔ singing → listening | UI 未接 |
| E | 旋律輸入：MIDI／#25 analyze JSON（僅合法／原創） | #25 未合併 |
| F | 驗收：F0 逐音、聽感、中文可懂度、iPhone Safari | 全部尚未 |

**阻斷：** GPU／免費神經 TTS·歌唱；中文音素對齊；人聲分離；#21/#25 未進 main；產品路徑禁止 DSP／Web Speech 冒充。

---

## 6. 已完成 vs 阻塞（給使用者）

### 已完成（本輪）
1. 核對 #21/#25/#22–#24 與 main 演示頁真實狀態  
2. 本機重跑英文四小節並保存 WAV/MIDI/JSON/音高  
3. 重跑 #21 8/8、#25 15/15 測試  
4. 產出中文 DSP 清唱試聽＋誠實評分  
5. #31 已由他處合併；live URL 可開（能力標籤如上）  
6. 本報告

### 阻塞／未做
1. **BLOCKED_NEED_GPU** — 自然中文說／唱神經合成  
2. 完整歌曲分析（分段、分離、forced alignment、換氣）  
3. 網站產品歌唱入口（不應把 DSP 標 AVAILABLE）  
4. 說↔唱同一會話實裝與 iPhone 實測  
5. 未合併 #21/#25（需另核准；本報告不強合）

### 明確非完成項
- `dawn-natural-female-v2.wav` 入庫 ≠ 歌唱上線 ≠ 即時語音上線  
- 8 音符／120.27 BPM ≠ 通用全曲規則  
- mock／單元測試 ≠ 網站已接通
