# 需要：乾淨、對話式的真人說話樣本

**日期：** 2026-10-24（Asia/Taipei）  
**背景：** Option B — 清唱 MP4 只當唱歌／音律參考。Max Factor 廣告抽出為 **`CANDIDATE_REJECTED_AS_IS`**（BGM＋廣告腔），**未**設為說話 TARGET。

## 現行狀態（誠實）

| 項目 | 狀態 |
|------|------|
| 說話參考 | `dawn-natural-female-v2.wav` → **REFERENCE_WAV_READY**（暫用） |
| 唱歌／音律參考 | `dawn-singing-melody-ref-v1.wav` → **SINGING_MELODY_REF_READY** |
| v3 廣告抽出 | reports only → **CANDIDATE_REJECTED_AS_IS**（可做人聲分離實驗） |
| 產品播音 | **MUTED / BLOCKED_NEED_GPU** |
| AVAILABLE | **禁止** |

待使用者選擇：① 對 v3 做人聲分離再評；② 上傳乾淨無 BGM 說話；③ 音色暫留 v2。

## 驗收條件（未來說話樣本）

1. 真人自然國語女聲（或角色一致），連續同一說話者  
2. **是說話**，不是唱歌；不是 Web Speech；不是合成旁白  
3. **無持續 BGM／強伴奏**（或已人聲分離且聽感乾淨）  
4. **對話式**抑揚（非廣告播報腔）：陳述、疑問、強調、停頓  
5. 建議 ≥ 30–60 s；安靜房間；24 kHz mono PCM 理想  

建議檔名：`dawn-natural-female-v3-speak.wav`（僅在通過上列條件後入庫為 TARGET）。

## 產品狀態一字串

`SPEAK: REFERENCE_WAV_READY(v2) · SING_MELODY_REF_READY · v3=CANDIDATE_REJECTED_AS_IS · MUTED/BLOCKED_NEED_GPU · NOT AVAILABLE`
