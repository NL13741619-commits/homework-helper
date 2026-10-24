# 曙光唱歌／音律參考：影片音軌 → dawn-singing-melody-ref-v1

**量測時間：** 2026-10-24 13:27 Asia/Taipei（抽出）  
**政策修正：** 2026-10-24 Option B（使用者選擇 B）  
**範圍：** 第二基地 `homework-helper` 僅  
**產品狀態：** **非 AVAILABLE** · `SINGING_MELODY_REF_READY` · **不是**即時說話 TARGET

## 使用者決策（權威）

**Option B：** 本影片／抽出 wav 僅作**唱歌／旋律／抑揚頓挫性格**參考，**不是**曙光即時對話說話克隆主語料。  
說話需另找**真人自然講話**錄音（見 `SPEAKING-PROSODY-SAMPLE-NEEDED.md`）。  
說話參考暫維持 `dawn-natural-female-v2.wav`。

## 來源誠實說明

使用者上傳 MP4（約 75.8 秒）。畫面為手機「清唱」搜尋／瀏覽錄影。聽感分析：

- 約 85% 為清唱／唱歌；多段不同女生聲線（粵語一段＋國語幾段）
- 約 1:04–1:08 為社群常見**電子合成旁白**（拒絕當產品聲）
- **不得**標 AVAILABLE；**不得**當 realtime speaking TARGET

## 抽出

```bash
ffmpeg -i <user.mp4> -vn -acodec pcm_s16le -ar 24000 -ac 1 \
  /workspace/reports/dawn-voice/dawn-singing-melody-ref-from-video.wav
cp … → app/assets/dawn-voice/dawn-singing-melody-ref-v1.wav
```

| 檔案 | 路徑 |
|------|------|
| 報告用 wav | `/workspace/reports/dawn-voice/dawn-singing-melody-ref-from-video.wav` |
| 倉庫資產 | `app/assets/dawn-voice/dawn-singing-melody-ref-v1.wav` |
| 說話參考（現行） | `app/assets/dawn-voice/dawn-natural-female-v2.wav` |

## 量測（粗測；唱歌 F0 研究用，非說話語料）

| 指標 | singing-melody-ref-v1 | natural-female-v2（說話參考） |
|------|----------------------|-------------------------------|
| 時長 | 75.784 s | 5.156 s |
| 取樣 | 24 kHz mono PCM s16 | 24 kHz mono PCM s16 |
| 大小 | 3,637,730 B | 247,560 B |
| RMS | −15.26 dBFS | −23.29 dBFS |
| Peak | −0.41 dBFS | −7.37 dBFS |
| F0 median（粗） | ~247 Hz | ~258 Hz |
| F0 stdev（唱歌音高走勢代理） | **~75.4 Hz** | ~51.3 Hz |
| SHA-256 | `f067dd215e87d8787b3ca375596b59d44ad369cb74e169f119432696194142ea` | `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce` |

**對照結論：** 影片 wav 適合作**唱歌／F0 音律**研究；因多說話者＋清唱為主，**不適**作即時對話說話克隆。v2 仍為說話錨點，**不刪除**。

## 政策（Option B）

- **唱歌／音律／抑揚性格參考：** `dawn-singing-melody-ref-v1.wav`（本影片音軌）
- **即時說話產品聲參考：** `dawn-natural-female-v2.wav`（直到更好的說話樣本）
- **產品 TTS：** 仍 **MUTED / BLOCKED_NEED_GPU**
- **禁止：** Gemini Live、瀏覽器 `speechSynthesis` 當產品聲、付費 API 測試、把 1:04 合成旁白當產品聲
- **不得標 AVAILABLE**

機器可讀：`docs/evidence/dawn-singing-melody-ref-v1.json` · 報告 `SINGING-MELODY-REF-FROM-VIDEO.*`
