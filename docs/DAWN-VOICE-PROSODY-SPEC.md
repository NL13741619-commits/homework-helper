# 曙光產品語音：抑揚頓挫規格（Prosody）

**日期：** 2026-10-24（Asia/Taipei）  
**範圍：** 第二基地自有即時語音產品聲  
**禁止：** 瀏覽器 `speechSynthesis`、Piper 等平坦電音冒充產品聲；Gemini Live 生產依賴

## 1. 產品要求（必須）

即時產品 TTS 輸出必須具備可感知的**抑揚頓挫**，不得是單調機器腔：

| 要求 | 說明 | 驗收提示 |
|------|------|----------|
| 音高變化（pitch variation） | 句內／句間 F0 有起伏，非近似平線 | 聽感；可選量測 F0 range／CV |
| 句重音（phrase stress） | 關鍵詞略抬高或拉長 | 聽感 |
| 停頓與節奏 | 標點／意群有自然換氣感 | 聽感 |
| 情緒／風格可控 | 能依角色（曙光／小太陽）與情境微調 | instruct／emotion 標籤 |

**明確拒絕：** 平坦合成腔、電音拼接感、整句同音高。

## 2. 參考檔分析（dawn-natural-female-v2.wav）

粗測（autocorr F0 + RMS，非專業語料工具）：

| 指標 | 數值 |
|------|------|
| 時長 | ~5.16 s · 24 kHz mono PCM |
| SHA-256 | `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce` |
| F0 mean / stdev | ~255 Hz / ~55 Hz |
| F0 range | ~278 Hz（約 86–364 Hz） |
| F0 CV | ~0.22 |
| RMS CV | ~0.74 |

**誠實結論：** 參考錄音本身**不是**「死平」——有明顯音高與能量變化，適合作為克隆音色錨點。  
使用者感覺「缺乏抑揚頓挫」，更可能來自：**尚未接通具風格／情緒指令的神經 TTS**（目前產品播音 MUTED／BLOCKED_NEED_GPU），而不是參考檔完全無韻律。

若克隆後仍偏平，再考慮：
1. 補錄更長、更多情緒／疑問／強調句的參考（同音色），或  
2. 選用 **instruct／emotion** 類引擎（Qwen3-TTS、CosyVoice 等）並調 style，而不是換回平坦電音。

## 3. 引擎優先序（免費／自架）

1. **優先：** Qwen3-TTS 或 CosyVoice（支持指令／情感／克隆）— 需 GPU → 現況 `BLOCKED_NEED_GPU`
2. **禁止當產品：** Web Speech、Piper、其他明顯電音／平調引擎
3. **預覽認可 wav：** 允許（播放真人參考錄音 ≠ 電音合成）

## 4. 狀態機（誠實標籤）

| 狀態 | 意義 |
|------|------|
| REFERENCE_WAV_READY | 認可參考已入庫，可預覽 |
| BLOCKED_NEED_GPU | 即時神經克隆未部署 |
| AVAILABLE | **僅當**神經 TTS 聽感通過抑揚頓挫規格 |

## 5. 說話能唱歌（與 #22–#24 對齊）

- 產品「唱歌」必須是**有音高軌跡的人聲／歌聲模型**，不是朗讀加 pitch slider，也不是 Web Audio sine（`EXPERIMENTAL_DSP_SINGING`）。
- 說話與唱歌共用自然聲線錨點（`dawn-natural-female-v2.wav` 或後續小太陽專用參考）。
- 旋律須可對照 MIDI／JSON；F0 隨時間應跟隨指定音符。
- 詳見 `docs/DAWN-VOICE-AND-SINGING-PLAN.md`。
