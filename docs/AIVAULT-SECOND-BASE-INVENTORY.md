# AIVAULT 第二基地｜第一階段盤點

日期：2026-10-22
狀態：NON-DESTRUCTIVE INVENTORY

## 保護區（禁止施工）

- GitHub `NL13741619-commits/safe-reunion-login`
- Supabase `perfsipperncvjocznhl` (`safe-reunion`)

本次盤點未對上述正式安全團聚前後端進行任何修改。

## 第二基地 GitHub 現況

Repository: `NL13741619-commits/homework-helper`

盤點開始時 main 舊系統檔案：
- `README.md` — 舊 Homework Helper 說明
- `index.html` — Email/Password Auth 登入與註冊
- `home.html` — 作業批改、圖片上傳、AI 呼叫、歷史紀錄
- `admin.html` — 帳號與 `homeworks` 歷史管理
- `icon-180.png`

前端已明確指向 Supabase `svtkpdmqemidlasowqew`，並使用 publishable key。
`home.html` 呼叫 `/functions/v1/bright-service`，並讀寫 `homeworks`。

本輪另新增非破壞性的盤點/架構/保護邊界文件；未修改或刪除上述舊系統前端檔案。

## 第二基地 Supabase 現況

Project ref: `svtkpdmqemidlasowqew`
Name: `homework-helper`
Region: `ap-northeast-1`
Status: `INACTIVE`
PostgreSQL: 17

可見 Edge Functions：
1. `bright-service` — ACTIVE, verify_jwt=true
2. `constitution-import` — ACTIVE, verify_jwt=true
3. `fetch-roc-tw-constitutional-court` — ACTIVE, verify_jwt=false

資料表盤點目前因專案 INACTIVE 導致 DB connection timeout，尚未取得完整 schema。不得因此推定資料不存在。

## 初步分類

### 暫時保留／等待確認
- `homeworks` 及其資料
- Auth users
- Storage buckets/objects
- 所有既有 DB schema / RLS / RPC
- 三個既有 Edge Functions
- 舊前端四個主要檔案

### AIVAULT 第二基地可重建目標（設計階段）
- AIVAULT Auth / admin identity
- `ai_agent_tasks`
- `ai_agent_runs`
- `ai_agent_events`
- `ai_agent_leases`
- `ai_model_usage`
- audit log
- protected Gemini gateway
- agent intake/status Edge Functions

## 下一步閘門

1. 恢復/喚醒 `svtkpdmqemidlasowqew` 前，確認不會造成未核准費用。
2. DB 恢復可讀後先做完整 schema/RLS/RPC/Auth/Storage 盤點。
3. 先備份/記錄可回復資訊，再提出 cleanup 清單。
4. 未取得 destructive cleanup 核准前，不刪除任何舊資料、函式或前端。
5. 後續自主 Agent 程式碼施工採 feature branch + Draft PR，不允許自主 runner 直接寫 main。此次由主控 GPT 寫入 main 的內容僅限盤點、架構與機器可讀安全邊界文件。

## 安全結論

目前可確認第二基地與正式安全團聚使用不同 GitHub repository 與不同 Supabase project ref。第一階段只完成盤點、設計與施工邊界建立，尚未執行 destructive migration。
