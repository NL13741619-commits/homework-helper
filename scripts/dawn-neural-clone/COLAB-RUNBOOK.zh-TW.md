# 曙光神經克隆 · Colab 免費 GPU 操作手冊（中文）

**使用者決策（t314）：** 用 **Google Colab 免費 GPU** 解鎖曙光說話克隆樣品。  
**不是** Gemini Live；**不是**產品已接通。

## 你要點什麼

1. **Google 登入**（Colab 會要求；請你本人完成，代理人不能代登）。  
2. 打開 notebook 後：**Runtime（執行階段）→ Change runtime type（變更執行階段類型）→ Hardware accelerator = GPU（T4）→ Save**。  
3. 由上到下 **Run all**（或逐格執行）。  
4. 上傳格出現時：選本機的 `dawn-natural-female-v3-speak.wav`。  
5. 結束後下載 `dawn-v3-qwen3-clones.zip`，聽感後交回維護者。

## 檔案在哪

| 項目 | 路徑 |
|------|------|
| Notebook | `scripts/dawn-neural-clone/dawn-v3-colab-qwen3-tts.ipynb` |
| 參考 wav（倉庫） | `app/assets/dawn-voice/dawn-natural-female-v3-speak.wav` |
| 計畫 | `/workspace/reports/dawn-voice/NEURAL-CLONE-DEPLOY-PLAN.md` |
| 報告副本 notebook | `/workspace/reports/dawn-voice/colab/` |

## 建議引擎

- **首選（本 notebook）：** Qwen3-TTS-12Hz-**0.6B**-Base（Apache-2.0，T4 友善）  
- 可改 1.7B-Base（較像完整品質、較吃顯存）  
- 備選：CosyVoice2（Apache-2.0；另開 notebook／環境）

## 聽感前禁止

- 不要標產品 `AVAILABLE`  
- 不要接 Gemini Live / 瀏覽器電音當曙光聲  

## Colab 限制（誠實）

- 免費額度、閒置斷線、排隊、GPU 種類不保證  
- **只適合解鎖樣品**；日常產品推論之後仍要本機或自架 GPU（見 `app/services/aivault-voice`）

## 通過聽感之後

把 zip 放到 `reports/dawn-voice/neural-poc/colab-out/`，維護者再接 `dawn-neural-tts.js` 與自架服務。
