# 曙光即時語音新目標：影片音軌 → dawn-realtime-target-v1

**量測時間：** 2026-10-24 13:27 Asia/Taipei  
**範圍：** 第二基地 `homework-helper` 僅  
**產品狀態：** **非 AVAILABLE** · `REFERENCE_TARGET_READY` · 神經克隆仍 `BLOCKED_NEED_GPU`

## 來源

使用者於聊天上傳的 MP4（約 75.8 秒）。畫面為手機「清唱」搜尋／瀏覽錄影；**採用音軌**作為曙光即時說話聲線新目標。

## 抽出

```bash
ffmpeg -i <user.mp4> -vn -acodec pcm_s16le -ar 24000 -ac 1 \
  /workspace/reports/dawn-voice/dawn-realtime-target-from-video.wav
cp … → app/assets/dawn-voice/dawn-realtime-target-v1.wav
```

| 檔案 | 路徑 |
|------|------|
| 報告用 wav | `/workspace/reports/dawn-voice/dawn-realtime-target-from-video.wav` |
| 倉庫資產 | `app/assets/dawn-voice/dawn-realtime-target-v1.wav` |
| 早期參考（保留、未刪） | `app/assets/dawn-voice/dawn-natural-female-v2.wav` |

## 量測（粗測，非專業語料工具）

| 指標 | realtime-target-v1（新目標） | natural-female-v2（早期參考） |
|------|------------------------------|-------------------------------|
| 時長 | 75.784 s | 5.156 s |
| 取樣 | 24 kHz mono PCM s16 | 24 kHz mono PCM s16 |
| 大小 | 3,637,730 B | 247,560 B |
| RMS | −15.26 dBFS | −23.29 dBFS |
| Peak | −0.41 dBFS | −7.37 dBFS |
| F0 median（粗） | ~247 Hz | ~258 Hz |
| F0 stdev（抑揚頓挫粗代理） | **~75.4 Hz** | ~51.3 Hz |
| SHA-256 | `f067dd215e87d8787b3ca375596b59d44ad369cb74e169f119432696194142ea` | `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce` |

**對照結論：** 新目標明顯更長、更響，音高起伏代理值較高，較符合使用者「要有抑揚頓挫」的方向。v2 仍保留作早期錨點，**不刪除**。

## 政策

- **即時說話產品聲目標：** `dawn-realtime-target-v1.wav`（本影片音軌）
- **產品 TTS：** 仍 **MUTED / BLOCKED_NEED_GPU**，直到免費神經克隆聽感通過
- **禁止：** Gemini Live、瀏覽器 `speechSynthesis` 當產品聲、付費 API 測試
- **不得標 AVAILABLE**

## 唱歌／音律（分開記）

音軌含清唱式旋律與音高走勢。此部分交給唱歌模組（整首歌分析、字對旋律、說話⇄清唱）另案處理；**本剪輯本身 ≠ 唱歌產品已接通**。

機器可讀：`TARGET-FROM-VIDEO.json`
