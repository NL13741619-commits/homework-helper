# 曙光說話目標 v3（使用者堅持 · Demucs 分離）

**量測／分離時間：** 2026-10-24 13:41 Asia/Taipei  
**使用者覆寫（權威 t307u）：** 「我要這個配音當曙光說話的聲音」  
**範圍：** 第二基地 `homework-helper` 僅  
**產品狀態：** **非 AVAILABLE** · `REFERENCE_TARGET_READY`（v3 暫定說話目標） · `BLOCKED_NEED_GPU`

## 來源誠實說明

- 台灣 **Max Factor Lipfinity** 風格廣告配音（自然台灣國語女聲、純說話非唱歌）
- 原片有**持續大聲 BGM**；廣告播報腔（非日常對話抑揚）
- 使用者仍指定此聲線為曙光說話聲 → 已做人聲分離後入庫為**暫定**說話 TARGET

## 分離流程（免費本機）

```text
tool: Demucs 4.1.0 · model htdemucs · --two-stems=vocals
venv: /workspace/venvs/demucs (torch 2.14.1+cpu)
input: MP4 → stereo 44.1 kHz PCM → demucs
vocals → ffmpeg → 24 kHz mono PCM s16 → dawn-natural-female-v3-speak.wav
```

| 檔案 | 路徑 | SHA-256 |
|------|------|---------|
| 混合（分離前） | `/workspace/reports/dawn-voice/dawn-natural-female-v3-speak-from-video.wav` | `aff37e2e23005af31065f97d52413e1757f1c42ff64ee9103786c4c1f122ba8d` |
| **乾聲說話 TARGET** | `app/assets/dawn-voice/dawn-natural-female-v3-speak.wav` | `c42a877c6af9cb48384e4b9a8bf3d24aac137107faf49d5201955df69398cf1d` |
| 報告副本 | `/workspace/reports/dawn-voice/dawn-natural-female-v3-speak.wav` | （同上） |
| Demucs no_vocals（BGM 殘） | `/workspace/reports/dawn-voice/dawn-v3-demucs-no-vocals-stereo.wav` | `11aa3c7c043f542f7f0e905b4f5da5024e8fb3251c6444df325eaf6becf7ecc3` |
| 早期說話錨點 | `app/assets/dawn-voice/dawn-natural-female-v2.wav` | `75f94ca3…` |
| 唱歌／音律 ONLY | `app/assets/dawn-voice/dawn-singing-melody-ref-v1.wav` | `f067dd21…` |

## 量測

| 指標 | v3 dry（說話 TARGET） | v3 mix（分離前） | v2 |
|------|----------------------|------------------|-----|
| 時長 | 12.087 s | 12.087 s | 5.156 s |
| RMS | −20.11 dBFS | −19.17 dBFS | −23.29 dBFS |
| Peak | −5.96 dBFS | −6.15 dBFS | −7.37 dBFS |
| F0 median／stdev（粗） | ~240 / ~61 Hz | ~202 / ~81 Hz | ~261 / ~49 Hz |

**殘餘 BGM：** `no_vocals` 幹仍約 −26.7 dBFS RMS → 伴奏能量高；vocals 幹**可能仍有可聞殘響／滲漏**，聽感需人工確認。非專業工作室隔離。

## 政策

- **暫定即時說話目標：** `dawn-natural-female-v3-speak.wav`（REFERENCE_TARGET_READY）
- **保留：** v2；**清唱 wav：** singing/melody ONLY（Option B）
- **產品 TTS：** 仍 MUTED／BLOCKED_NEED_GPU；**不得**標 AVAILABLE
- **禁止：** Gemini Live、瀏覽器 speechSynthesis 當產品聲、付費 API

機器可讀：`docs/evidence/dawn-natural-female-v3-speak.json`
