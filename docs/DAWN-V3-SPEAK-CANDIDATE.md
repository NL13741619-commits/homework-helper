# v3 speak candidate — CANDIDATE_REJECTED_AS_IS

**日期：** 2026-10-24 13:37–13:38 Asia/Taipei  
**來源：** 使用者新上傳 Max Factor 風格廣告影片（「用這個聲音當曙光說話的聲音」）  
**抽出：** `/workspace/reports/dawn-voice/dawn-natural-female-v3-speak-from-video.wav`  
**SHA-256：** `aff37e2e23005af31065f97d52413e1757f1c42ff64ee9103786c4c1f122ba8d`  
**時長：** ~12.09 s · 24 kHz mono PCM s16 · RMS −19.17 dBFS · F0 stdev 粗測 ~80.6 Hz

## watchVideo／聽感（權威否決理由）

- ✅ 純**說話**（非唱歌）；單一自然台灣國語女聲  
- ❌ **持續大聲 BGM** — 未人聲分離前不適合作克隆主語料  
- ❌ **廣告播報腔** — 銷售抑揚，非對話式說話  

**結論：** **`CANDIDATE_REJECTED_AS_IS`** — **不要**設為產品即時說話 TARGET；**不要**標 AVAILABLE。  
檔案保留於 reports，供之後人聲分離實驗；**未**入庫為 `app/assets` 說話目標。

## 現行產品說話錨點

仍為 **`dawn-natural-female-v2.wav`**（REFERENCE_WAV_READY），直到使用者選擇：

1. 對 v3 做人聲分離後再評，或  
2. 等待乾淨無 BGM 的說話上傳，或  
3. 音色暫用 v2  

## 與 Option B 關係

- 舊清唱 MP4 → `dawn-singing-melody-ref-v1.wav`（唱歌／音律 ONLY）  
- 說話 → v2 直到使用者另選  

機器可讀：`docs/evidence/dawn-v3-speak-candidate-rejected.json` · reports `SPEAKING-V3-FROM-VIDEO.*`
