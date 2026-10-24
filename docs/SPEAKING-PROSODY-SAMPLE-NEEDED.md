# 需要：有抑揚頓挫的真人說話樣本（Option B）

**日期：** 2026-10-24（Asia/Taipei）  
**範圍：** 第二基地曙光即時**對話說話**克隆  
**背景：** 使用者選 Option B — 清唱 MP4／`dawn-singing-melody-ref-v1.wav` **只當唱歌／音律參考**，不當說話 TARGET。

## 現行狀態（誠實）

| 項目 | 狀態 |
|------|------|
| 說話參考 | `dawn-natural-female-v2.wav` → **REFERENCE_WAV_READY**（暫用，偏短） |
| 唱歌／音律參考 | `dawn-singing-melody-ref-v1.wav` → **SINGING_MELODY_REF_READY**（非說話） |
| 產品播音 | **MUTED / BLOCKED_NEED_GPU** |
| AVAILABLE | **禁止**，直到神經 TTS 聽感通過 |

建議新檔名（到達後）：`dawn-natural-female-v3-speak.wav`（或同等清晰命名）。

## 驗收條件（必須全部滿足）

1. **真人自然國語女聲**（或與曙光角色一致的音色），連續同一說話者  
2. **是說話，不是唱歌／清唱**；不是瀏覽器／Web Speech；**不是**影片 1:04–1:08 那段電子合成旁白  
3. 長度建議 **≥ 30–60 秒**（越長越好，利於克隆）  
4. 安靜房間；理想 **24 kHz mono PCM s16**（`.wav`）  
5. 內容必須涵蓋**抑揚頓挫**：
   - 陳述句  
   - 疑問句  
   - 強調／重音詞  
   - 自然停頓／換氣  
6. 單一語種優先（國語）；避免多說話者拼接  

## 明確拒絕

- 清唱／K 歌／帶強伴奏  
- 多段不同女生拼貼  
- 合成 TTS／電音／「機器人」腔  
- 把唱歌參考冒充說話 TARGET  

## 入庫後政策

- 說話克隆錨點切到新 speak wav；v2 可保留作對照  
- 唱歌參考仍用 `dawn-singing-melody-ref-v1.wav`（分開）  
- 產品 TTS 仍 MUTED／BLOCKED_NEED_GPU，直到免費神經克隆聽感通過  
- **仍不得**僅因有 wav 就標 AVAILABLE  

## 產品狀態一字串（現行）

`SPEAK: REFERENCE_WAV_READY(v2) · SING_MELODY_REF_READY(video) · MUTED/BLOCKED_NEED_GPU · NOT AVAILABLE`
