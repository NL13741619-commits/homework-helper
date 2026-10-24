# 說話樣本狀態（v3 暫定已指定 · 仍可再換）

**日期：** 2026-10-24（Asia/Taipei）  
**更新：** 使用者堅持 Max Factor 配音 → Demucs 分離後 **`dawn-natural-female-v3-speak.wav`** 為暫定說話 TARGET。

## 現行狀態

| 項目 | 狀態 |
|------|------|
| 說話 TARGET | `dawn-natural-female-v3-speak.wav` → **REFERENCE_TARGET_READY**（短、廣告腔、可能殘 BGM） |
| 早期錨點 | `dawn-natural-female-v2.wav`（保留） |
| 唱歌／音律 | `dawn-singing-melody-ref-v1.wav` → SINGING_MELODY_REF_READY |
| 產品播音 | **MUTED / BLOCKED_NEED_GPU** |
| AVAILABLE | **禁止** |

若日後要換更長、無 BGM、對話式樣本，仍適用原驗收條件（≥30–60s、安靜房、陳述／疑問／強調／停頓）。

## 產品狀態一字串

`SPEAK: REFERENCE_TARGET_READY(v3-demucs) · SING_MELODY_REF_READY · MUTED/BLOCKED_NEED_GPU · NOT AVAILABLE`
