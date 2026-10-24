# 曙光城（Base 2）媒體施工盤點與實作報告

日期：2026-10-24（Asia/Taipei）  
倉庫：`NL13741619-commits/homework-helper`  
後端：Supabase `svtkpdmqemidlasowqew`  
政策：免費／自架；禁止 Magic Hour image→video；禁止 Gemini Live 作為 Base 2 語音依賴；Draft PR；不覆寫 Base 1。

---

## 1. 網站／Issue 施工單清單（讀自 GitHub Issues）

| # | 標題摘要 | 狀態 | 本輪處理 |
|---|----------|------|----------|
| 1 | 第二基地重建施工令 | OPEN | 遵守邊界；不 destructive |
| 5 | 暗星 JPG 教學與實作驗收 | OPEN | **已實作 Phase 1（Canvas JPEG）**；Phase 2 AI 生圖 BLOCKED |
| 7 | Qwen 端到端驗收 | OPEN | 既有；未改 |
| 10 | 小太陽數字人修復 | OPEN | 入口保留；語音改走免費頁 |
| 12 | 小太陽 UI 改善 | OPEN | media hub 以曙光／小太陽為先 |
| 13–14 | AI 核心／Gateway | OPEN | 未動付費閘 |
| 15 | Dawn Voice Engine | OPEN | 瀏覽器 TTS 已 REJECTED 當產品聲；等 wav+神經 TTS；Gemini Live 禁用 |
| 16–20 | 自主模型／即時語音 | OPEN | 標示 Draft PR #21/#26；不合併冒充上線 |
| 22–24 | 歌唱／聽歌學唱 | OPEN | DSP 四小節原型；神經歌唱仍 EXPERIMENTAL／BLOCKED |
| 21 PR | 本機 Qwen+歌唱 | DRAFT | 短名單引用，未合併 |
| 25 PR | 旋律／押韻 | DRAFT | 短名單引用，未合併 |
| 26 PR | 本地即時語音 | DRAFT | 短名單引用；非 Gemini Live |

保護區：`perfsipperncvjocznhl`、safe-reunion — **未碰**。

---

## 2. 主城暗星 JPG 路徑審計 → 曙光差距

### Base 1 實際路徑
- Edge：`supabase/functions/dawn-light-image/index.ts` **代理**到 `dark-star-image-generation`。
- 上游語意：Gemini image 類能力（見 ebook-ingest agents 的 `gemini-image`／`GEMINI_API_KEY`）。
- 輸出：期望 JPEG；拒絕 SVG。
- **結論**：主城「真 AI JPG」依賴 Gemini／金鑰，**不是**可直接複製到 Base 2 的免費能力。Issue #5 也明示「未取得暗星既有生圖實作證據前不可宣稱複製」。

### Base 2 缺口（施工前）
- 無 `dawn-light-image` function。
- 無 JPG 測試頁／exportJpeg。
- `media.html` 只顯示 Magic Hour 目錄狀態。
- `profile.mjs`：`image: NOT_PORTED`。

### Base 2 免費方案（本輪）
| 項目 | 設計 | 狀態 |
|------|------|------|
| Phase 1 Canvas JPEG | `app/dawn-jpg-studio.html` + `export-jpeg.js` + `procedural-poster.js` | **DONE / TESTED**（真實 JPEG 樣本） |
| Phase 2 神經生圖 | Edge `dawn-light-image` 誠實回 `BLOCKED_NO_FREE_IMAGE_PROVIDER`；**不**代理 Base 1 | **BLOCKED**（無免費 provider；需用戶核准才可接外部免費端） |
| 付費／Gemini | 不呼叫 | **DISABLED** |

證據：
- `docs/evidence/jpg-studio/dawn-image-sample.jpg`（1280×720，SOI/EOI 通過，63925 bytes）
- `docs/evidence/jpg-studio/dawn-image-night.jpg`（1024×1024，第二提示詞）
- `docs/evidence/jpg-studio/export-meta.json`

---

## 3. 音樂／語音／短影片模組短名單

| 模組 | 類型 | 引擎 | 授權 | 狀態 |
|------|------|------|------|------|
| 免費語音 ASR | owned UI + 瀏覽器 | Web Speech Recognition | 瀏覽器／OS | AVAILABLE_BROWSER（僅辨識） |
| 瀏覽器 TTS 當產品聲 | — | speechSynthesis | 瀏覽器／OS | **REJECTED**（電音；2026-10-24） |
| 產品自然 TTS | owned 部署 | 認可 wav + 神經 TTS（如 Qwen3-TTS） | 待 GPU／權重 | WAITING / NOT_DEPLOYED |
| Gemini Live（既有 `dawn-light-live-voice.js`） | 外部 | Gemini Live relay | 付費／配額風險 | **DISABLED_BY_POLICY**（本輪不接 UI） |
| 自架 Qwen3-TTS | owned 部署程式 | `app/services/aivault-voice` | Apache-2.0 上游權重 | NOT_DEPLOYED（需 GPU 節點） |
| Draft PR #21/#26 | owned local-ai | Qwen + Flite/WORLD 等 | 見各 PR | DRAFT 未合併 |
| 歌唱 DSP 四小節 | owned | Web Audio | AIVAULT 原創合成 | EXPERIMENTAL_DSP_SINGING |
| Draft PR #25 旋律分析 | owned | 本機 WAV/MIDI | 見 PR | DRAFT |
| 免費短片 | owned | Canvas + MediaRecorder | AIVAULT | AVAILABLE*（視瀏覽器；iOS 可能 BLOCKED） |
| Magic Hour 圖生影片 | 外部付費 | Magic Hour | 商業 | **GATES_CLOSED · 禁止呼叫** |

頁面：
- `app/dawn-voice-free.html`
- `app/dawn-music-free.html`
- `app/dawn-short-video-free.html`
- `media.html`（小太陽／曙光優先）

---

## 4. 阻斷與需用戶核准

1. **神經網路 AI 插畫**：無已驗證免費 provider → 維持 BLOCKED。若要接 Pollinations／HF 免費端，需另核准（仍須身份驗證、額度、誠實日誌）。
2. **Magic Hour image→video 金鑰**：政策禁止使用；閘保持關閉。
3. **Gemini Live 語音**：政策禁止作為 Base 2 依賴；完整即時語音需自架 ASR/TTS 或合併 Draft PR #26 並驗證。
4. **自架 Qwen3-TTS／歌唱神經模型**：需要 GPU／磁碟節點與部署核准。
5. **Supabase Edge 部署**：本輪只提交程式；未對 `svtkpdmqemidlasowqew` 執行 `functions deploy`（避免未核准的線上變更）。Pages 需 PR 合併後才會更新 GitHub Pages。
6. **Draft PR 政策**：`aivault-second-base.json` 規定 `draft_pr_only: true`，不直寫 main。

---

## 5. 本輪交付檔案

- `app/dawn-jpg-studio.html`
- `app/dawn-voice-free.html`
- `app/dawn-music-free.html`
- `app/dawn-short-video-free.html`
- `app/dawn-free/*`（export-jpeg、procedural-poster、browser-voice、melody-sing、short-video、CSS、CAPABILITY.md）
- `supabase/functions/dawn-light-image/index.ts`
- `media.html`（改版）
- `docs/evidence/jpg-studio/*`

## 6. Done vs Blocked 摘要

| 能力 | Done | Blocked |
|------|------|---------|
| Canvas→真實 JPEG | ✓ | |
| AI 插畫 | | BLOCKED_NO_FREE_IMAGE_PROVIDER |
| 瀏覽器語音（產品聲） | REJECTED | 等 wav+神經 TTS；Gemini Live 禁用 |
| DSP 歌唱原型 | ✓（實驗） | 神經歌唱／聽歌翻唱 |
| Canvas 短片 | ✓* | Magic Hour / AI 圖生影片 |
| Edge image 誠實封鎖 | ✓（程式） | 未 deploy 到線上 |

