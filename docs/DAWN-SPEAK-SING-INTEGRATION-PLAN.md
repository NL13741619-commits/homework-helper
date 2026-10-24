# 曙光說＋唱整合計畫（Base 2）

日期：2026-10-24（Asia/Taipei）  
狀態：**PLAN**（產品歌唱 **NOT AVAILABLE**）  
倉庫：`NL13741619-commits/homework-helper`  
父代理擁有：PR **#25** 驗證 — **不合併、不宣稱 live**。

標籤約定：**已實作**｜**原型**｜**尚未完成**

---

## 0. 上線現況（語音基礎設施，非歌唱產品）

| 項目 | 標籤 | 證據 |
|------|------|------|
| PR #31 own-voice MVP + natural wav → main | **已實作** | merge `caa3f120e521ab116060d64cf5f344ae0f885f03`；Pages `built` |
| `dawn-own-voice-test.html` | **已實作**（測試頁） | https://nl13741619-commits.github.io/homework-helper/app/dawn-own-voice-test.html → HTTP 200 |
| `dawn-natural-female-v2.wav` | **已實作**（參考資產） | `…/app/assets/dawn-voice/dawn-natural-female-v2.wav` → HTTP 200，RIFF 247560 bytes |
| 產品即時 TTS | **尚未完成** | PENDING_FREE_NEURAL_TTS／BLOCKED_NEED_GPU |
| 瀏覽器合成當產品聲 | 已駁回 | REJECTED；預設靜音 |
| Gemini Live | 禁用 | DISABLED |
| 產品歌唱上線 | **尚未完成** | NOT AVAILABLE |

---

## 1. 同一聲線身份（speak ≡ sing）

| 層 | 來源 | 標籤 |
|----|------|------|
| voice_id `dawn-natural-female-v2` | 認可自然女聲 | **已實作**（資產） |
| 說話產品路徑 | 免費神經 TTS 條件於參考 wav | **尚未完成** |
| 唱歌產品路徑 | 同一 timbre／speaker；旋律＋歌詞 | **尚未完成**（等 #25＋神經路徑） |
| 參考播放／粗抑揚 | `dawn-sing-ref.html` REFERENCE_PLAYBACK | **原型**（非神經、非產品 AVAILABLE） |
| DSP 振盪歌唱 | `dawn-music-free.html` | **原型** EXPERIMENTAL_DSP（非產品） |

原則：說與唱必須是同一個「曙光」；禁止產品說話用自然聲、唱歌用電音還標 AVAILABLE。

---

## 2. 抑揚頓挫（prosody）

| 能力 | 標籤 | 說明 |
|------|------|------|
| 參考檔本身有自然起伏 | **已實作**（錄音特質） | 預覽 wav |
| 粗 playbackRate／gain 包絡演示 | **原型** | REFERENCE_PLAYBACK；非產品 |
| 神經 TTS instruct／emotion／F0 | **尚未完成** | 見 `DAWN-VOICE-PROSODY-SPEC.md` |
| 歌唱逐音節 F0 對旋律驗收 | **尚未完成** | 依賴 #25 與合成器 |

---

## 3. 全曲分析管線（ChatGPT 規則 · 2026-10-24）

目標：使用者指定／上傳合法音源後，產出可給小太陽唱的結構——**目前皆非站上 live 產品**。

| 步驟 | 內容 | 標籤 | 備註 |
|------|------|------|------|
| 3.1 分段 | 前奏／主歌／副歌／間奏／尾奏時間碼 | **尚未完成**（站上）；Draft PR #25 相關為父代理驗證中 | 不可標 AVAILABLE |
| 3.2 分軌（stem） | 人聲／伴奏分離（需時） | **尚未完成** | 免費工具选型待定；無權抓 DRM |
| 3.3 歌詞–旋律對齊 | 音節↔音符起迄 JSON | **原型**（僅 #25／local-ai 草稿側）；站上 **尚未完成** | 父代理驗證 #25 |
| 3.4 可選押韻 | 中文韻腳分組建議 | **原型**（#25 草稿）；站上 **尚未完成** | 非產品 |
| 3.5 授權／來源紀錄 | song_id、license、出處 | **尚未完成** | #24 要求 |

輸出契約（未來）：`{ song_id, license, bpm, segments[], stems?, notes[{pitch_midi,start,duration,syllable,confidence}], rhymes? }`  
在契約未由免費管線在 Base 2 跑通並附證據前，狀態維持 **尚未完成**。

---

## 4. 說↔唱切換＋插話（barge-in）

| 能力 | 標籤 | 說明 |
|------|------|------|
| 聊天 intent → 說話路由 | **原型** | own-voice 測試頁／MOCK；產品神經 TTS 未通 |
| 「唱兩句／唱歌」intent → 歌唱路由 | **尚未完成** | 不可用 DSP／Web Speech 冒充 |
| 同一 session 唱完回對話 | **尚未完成** | |
| 插話中止（barge-in）停止播音 | **原型** | own-voice 測試有中止；僅對目前播放路徑 |
| 唱中插話改聽／改說 | **尚未完成** | 需產品歌唱播放器 |
| 狀態機 listening／thinking／speaking／singing | **原型**（測試頁部分）／產品 **尚未完成** | 僅真實音訊驅動；禁定時假裝 |

---

## 5. 等 PR #25（父代理）什麼

- 短曲／中文女聲 a cappella 是否「能聽出是唱不是念」  
- 旋律 JSON／對齊是否可重現  
- 與 `dawn-natural-female-v2.wav` 如何接音色  

#25 通過後 Base 2 才做：證據入 `docs/evidence/dawn-voice/`、intent 路由、小太陽 singing 狀態——仍須免費神經或認可演唱檔，**通過前不標 AVAILABLE**。

---

## 6. Base 2 檔案地圖

- 資產：`app/assets/dawn-voice/dawn-natural-female-v2.wav`  
- 語音：`app/dawn-own-voice.js`、`dawn-own-voice-test.html`、`dawn-neural-tts.js`  
- 參考演示：`app/dawn-sing-ref.html`、`dawn-free/reference-playback.js`  
- 計畫：本檔、`DAWN-VOICE-PROSODY-SPEC.md`、`base2-singing-inventory.md`  
- Edge：`supabase/functions/dawn-own-tts/`（未宣告產品 AVAILABLE）

---

## 7. 不做

- 不合併／不宣稱 #25 live  
- 不把 Web Speech／DSP／REFERENCE_PLAYBACK 標成產品說／唱 AVAILABLE  
- 不付費 API、不 Gemini Live、不開 image→video  
