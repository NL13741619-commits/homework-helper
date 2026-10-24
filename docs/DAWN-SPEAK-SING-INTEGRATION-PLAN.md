# 曙光說＋唱整合計畫（Base 2）

日期：2026-10-24（Asia/Taipei）  
狀態：**PLAN**（產品歌唱 **NOT AVAILABLE**）  
範圍：僅 `NL13741619-commits/homework-helper`  
父代理擁有：PR **#25** a cappella／旋律驗證 — **本計畫不與其搶做、不合併 #25、不宣稱站上歌唱上線**。

## 1. 同一聲線身份（speak ≡ sing）

| 層 | 來源 | 狀態 |
|----|------|------|
| 聲線身份 ID | `dawn-natural-female-v2` | REFERENCE_WAV_READY |
| 參考錄音 | `app/assets/dawn-voice/dawn-natural-female-v2.wav`（24 kHz mono） | 可預覽 |
| 說話（產品） | 免費神經 TTS 條件於上列參考（Qwen3-TTS／CosyVoice 等） | PENDING_FREE_NEURAL_TTS／BLOCKED_NEED_GPU |
| 唱歌（產品） | 同一 timbre／speaker embedding；旋律＋歌詞對齊後合成或真實演唱檔 | NOT AVAILABLE（等 #25 結果＋神經路徑） |
| 瀏覽器 Web Speech | — | REJECTED（非產品） |
| Gemini Live | — | DISABLED |
| DSP 振盪器 | `dawn-music-free.html` | EXPERIMENTAL_DSP（非產品） |
| 參考變形演示 | `dawn-sing-ref.html` REFERENCE_PLAYBACK | 演示抑揚；非神經唱 |

原則：**說與唱必須聽起來是同一個「曙光」**，不可說話用自然女聲、唱歌用電音振盪器還標成產品。

## 2. 抑揚頓挫（prosody）

1. 產品說話：神經 TTS 的 instruct／emotion／pitch 曲線（見 `docs/DAWN-VOICE-PROSODY-SPEC.md`）。  
2. 產品唱歌：音符 MIDI／F0 目標＋同一 speaker；驗收比對 F0，不可只改整段 playbackRate 冒充。  
3. 站上現有 `REFERENCE_PLAYBACK` 粗包絡＝教學／聽感對照，**不得**標 AVAILABLE。

## 3. 等 PR #25 什麼

父代理驗證中（勿搶）：

- 旋律／歌詞對齊是否可重現  
- 短曲／中文女聲 a cappella 實驗是否達到「可聽是唱不是念」  
- 與 `dawn-natural-female-v2.wav` 音色條件如何接

#25 結果進來後，Base 2 整合步驟（仍免費）：

1. 把通過的旋律 JSON／測試音檔路徑寫進 `docs/evidence/dawn-voice/`（或鏈到 #25 artifact）。  
2. 產品路由：`intent=sing` → singing pipeline；`intent=chat` → neural TTS；共用 voice_id。  
3. 小太陽 UI 同一狀態機 listening／speaking／singing — 僅在真實音訊播放時進 singing。  
4. 仍不標 AVAILABLE，直到免費神經或認可演唱檔在 Pages 可重現播放並通過聽感＋F0 抽樣。

## 4. Base 2 檔案地圖（整合時改這裡）

- 聲線資產：`app/assets/dawn-voice/`  
- 自建語音：`app/dawn-own-voice.js`、`app/dawn-own-voice-test.html`、`app/dawn-neural-tts.js`  
- 參考演示：`app/dawn-sing-ref.html`、`app/dawn-free/reference-playback.js`  
- Edge（未宣告上線）：`supabase/functions/dawn-own-tts/`  
- 狀態／計畫：`app/dawn-free/OWN-VOICE-STATUS.md`、`docs/DAWN-SPEAK-SING-INTEGRATION-PLAN.md`、`docs/base2-singing-inventory.md`

## 5. 明確不做

- 不合併／不宣稱 PR #25 已上線  
- 不把 Web Speech／DSP 標成曙光產品說／唱  
- 不呼叫付費 API、不開 image→video、不用 Gemini Live  
