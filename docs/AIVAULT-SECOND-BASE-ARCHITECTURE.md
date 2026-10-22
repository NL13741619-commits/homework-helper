# AIVAULT 第二基地｜目標架構 v0.1

## 邊界

第二基地：
- GitHub: `NL13741619-commits/homework-helper`
- Supabase: `svtkpdmqemidlasowqew`

禁止施工：
- `NL13741619-commits/safe-reunion-login`
- Supabase `perfsipperncvjocznhl`

## 控制流

主城 GPT
→ GitHub 結構化施工令
→ AIVAULT intake
→ identity/schema/policy validation
→ task queue
→ lease/idempotency/fencing
→ isolated runner workspace
→ approved zero-cost model gateway
→ fixed allowlisted tests
→ Draft PR
→ evidence/audit report
→ human review

## 預定資料模型

- `ai_agent_tasks`: 工程命令、狀態、來源與 idempotency key
- `ai_agent_runs`: 每次執行、runner、開始/結束、結果
- `ai_agent_events`: append-only 狀態與稽核事件
- `ai_agent_leases`: claim/heartbeat/fencing token
- `ai_model_usage`: provider/model/request/quota/zero-cost evidence

狀態機：
`QUEUED → CLAIMED → RUNNING → TESTING → PR_OPEN → DONE`
失敗分支：`BLOCKED` / `FAILED`

## Edge Functions（預定）

- `aivault-agent-intake`
- `aivault-agent-status`
- `aivault-gemini-gateway`

Gateway 原則：
- model allowlist
- secret server-side only
- no paid fallback
- timeout/quota gate
- request/response redaction
- audit event

## GitHub 安全規則

- feature branch only
- Draft PR only
- no direct main write by autonomous runner
- no auto merge
- fixed test command allowlist
- path allowlist
- Issue/PR prose never becomes arbitrary shell
- immutable sender identity and replay protection

## 部署規則

目前文件只是設計，不代表 production deployment 授權。
Supabase schema migration、secret migration、舊資料刪除、正式 Gemini inference 與 production deployment 都必須經對應安全閘門。
