# OpenVoice V1 CPU PoC（煙測 · 非產品）

**時間：** 2026-10-24 Asia/Taipei  
**引擎：** OpenVoice V1（ZH base + tone color）· **CPU**  
**參考：** `dawn-natural-female-v3-speak.wav`  
**測試句：** 「你好，我是曙光。今天想先聽哪一段？」  
**輸出：** `poc-openvoice-v1-zh-from-v3.wav`（162860 bytes · ~3.7s · 22050 Hz）  
**牆鐘：** ~6.4 s（權重已在本地後）

## 誠實結論

| 項目 | 判定 |
|------|------|
| 本箱能否跑出一段克隆 wav？ | **能**（此煙測） |
| 可否當產品聲／標 AVAILABLE？ | **否** |
| 抑揚頓挫／聽感 | **未驗收**；OpenVoice V1 非產品首選；prosody 主要來自底模 |
| V2 checkpoint | MyShell S3／HF 下載失敗 → 改用 V1 |
| 產品狀態 | 仍 **`BLOCKED_NEED_GPU`**；解鎖路徑改 **Colab 免費 T4**（使用者 t314） |

機器可讀：`poc-result.json`
