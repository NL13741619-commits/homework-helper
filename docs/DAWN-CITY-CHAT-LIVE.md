# 曙光城獨立聊天與 Gemini Live

## 已確認的正式環境問題

2026-10-24：第二基地 `svtkpdmqemidlasowqew` 的已部署函式清單沒有舊頁呼叫的 `ai-gateway`、`technical-dark-star-live-voice-v2`、`technical-dark-star-voice-session`。登入使用第一基地 `clcddygkaaqqtsbswgdf`，但移植頁面讀取第二基地的本機登入項目。資料庫 `ai_agent_runtime_config` 的 `base-002:dawn-light` 模型設定仍為 `model:null, approved:false, provider:gemini, billing_mode:free_only`。缺少端點與未啟用模型可解釋失敗；尚未以登入的 iPhone 做端到端重現。

## 實作

- 第一基地來源 `m9wmtcb782-arch/AIVAULT`，commit `6f0de4a4ecef079de83985762d6d60190264932e`。比對 `technical-dark-star-live-session.js`、`darkstar-inpage-live.js`、`dawn-light-live-voice.js`、`artifacts/restore-live-controls.js`。
- 新頁 `app/dawn-city-chat.html`：預設曙光，小太陽在暗星之前且較大。沿用既有 `darkstar-orb.js` 的兩種動畫，不移除原版頁面與記錄。
- 聲音沿用第一基地的 30 種名稱以及 `dawnLightVoice` / `darkStarVoice` 儲存鍵；Gemini Live setup 使用各自選定的聲音與伺服器角色指令。
- 新後端 `dawn-city-ai`：共用現有第一基地登入的 owner/admin 驗證；一般文字對話、健康檢查、Gemini Live 雙向中繼。API key 僅在後端使用。
- 即時語音等到 Gemini `setupComplete` 才開始上傳 16 kHz PCM。模型回傳的 24 kHz PCM 播放並驅動角色嘴型；支援逐字稿及中斷播放。
- 視訊取得相機權限，預覽、切換前後鏡頭，每約 1.1 秒傳送 JPEG。結束、失敗及離頁釋放相機、音軌、WebSocket 與 AudioContext。不做無限重試。
- 文字與即時逐字稿記錄保存在以登入使用者隔離的本機記錄；這不是伺服器常駐記憶或跨裝置同步。
- 即時每次最長 120 秒、輸入總量 16 MB；需要重新點擊才能繼續。沒有啟用付費 fallback。

## 啟用條件與部署

本變更不更新現有 model_policy，不複製第一基地 API key，也不宣稱任何真實推論已成功。

1. 將 `dawn-city-ai/index.ts`、`protocol.mjs` 與 `../_shared/media-auth.mjs` 一起部署到第二基地，平台 JWT 檢查關閉（`verify_jwt=false`）；函式內仍必須驗證共用登入與角色。POST 與 WebSocket 都需要有效登入。
2. 在第二基地後端設定 `GEMINI_API_KEY` 或 `AIVAULT_GEMINI_API_KEY`，不要放在前端、GitHub 或日誌。
3. 以現有 model_policy 流程指定可用的 Gemini 文字 `model`，完成 `approved`、`free_only`、配額與授權證據、有效期限與 context transfer 設定。Live 另需實際支援 Live API 的 `live_model`、`live_approved:true` 和 `live_quota_evidence_id`。不要把一般文字模型名當 Live 模型，也不要填寫假的配額證據。
4. 在模型啟用與使用費用條件確認前，只執行 health，不發起推論或付費測試。
5. 部署前端後，以使用者登入的 iPhone 實測：一般對話、兩位角色的聲音、麥克風、相機、切換鏡頭、拒絕權限、斷線與結束後資源釋放。只有收到實際回覆才能標示推論驗證成功。

## 驗證

`node --experimental-strip-types --test tests/dawn-city*.test.mjs`：7 項測試通過，涵蓋未設定模型、權限、免費使用設定、聲音與身分、輸入限制、影像權限、文字輸出與 WebSocket 握手／清理。HTTP 與上游模型為 mock，不代表真實 Gemini 推論成功。

`node --check app/dawn-city-chat.js`、`node --experimental-strip-types --check supabase/functions/dawn-city-ai/index.ts`、`git diff --check` 通過。

瀏覽器驗收尚未完成：環境未安裝 Chromium，Playwright 下載回傳無效壓縮檔。後端 `dawn-city-ai` v1 已部署並回報 ACTIVE。正式端點的未登入 health 請求實測回傳 HTTP 401 / LOGIN_REQUIRED，且沒有進行推論。前端仍待合併部署，尚未測試真實 Gemini 金鑰、相機／麥克風或 iPhone 聲音播放。

官方協定參考：

- https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
- https://supabase.com/docs/guides/functions/websockets

回滾：還原兩個首頁連結到 `technical-dark-star.html`；原版頁面與所有原有腳本未修改。
