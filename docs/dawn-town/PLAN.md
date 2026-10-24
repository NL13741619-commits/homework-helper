# 曙光城城鎮（Dawn Town）施工計畫

日期：2026-10-24（Asia/Taipei）  
狀態：**PLAN_ONLY / SCAFFOLD_NOT_LIVE_INFERENCE**  
倉庫：`NL13741619-commits/homework-helper`（Base 2）  
資料庫目標：`svtkpdmqemidlasowqew`  
關閉開關：`DAWN_TOWN_OFF=1`（環境／localStorage／查詢參數皆可；預設開發中可關）

> 本文件是施工計畫，**不是**功能已 AVAILABLE 的宣告。  
> 參考 Base 1 協作池／town **概念**，禁止整包複製 Whiteout Survival 素材或 Base 1 私有頁 HTML。

---

## 0. 現況盤點（誠實）

| 項目 | 現況 |
|------|------|
| Base 2 `dawn-city.html` | 純 Three.js 裝飾場景（白天／夜晚），**無**人物進場、無 DB presence |
| Base 2 `app/aivault-town.html` | **代理載入 Base 1** `aivault_private_pages` slug=`agent-floor`；註解已寫「不向不存在的第二基地資料表查詢」 |
| Base 2 `aivault_presence` 表 | **不存在**（REST 回 PGRST205） |
| Auth | **共用 Base 1** `clcddygkaaqqtsbswgdf`（`shared-auth-config.js`） |
| 免費媒體建築素材 | JPG／語音／歌唱／短片頁已上線（PR #27），可當「建築入口」 |
| Magic Hour／Gemini Live | 政策禁止；城鎮不得接通 |

---

## 1. 產品目標

1. 曙光城有一座**可逛的城**，風格「像」主城協作池（工坊＝專案），但視覺與資產屬 Base 2。  
2. **中心地標＝曙光小太陽**（不是暗星塔）。  
3. **建築＝Base 2 研發專案**（見 §3）。  
4. 從主城「調派」過來的人／代理人必須**真正寫入 Base 2 狀態**才算進城工作；離城必須**走出城門**並觸發**真正回主城**的事件，方便創辦人看哪些 token／配額耗盡。  
5. 全程免費路徑優先；付費 API 不開。

---

## 2. 架構分層

```
[瀏覽器 Dawn Town UI]
    │  Auth session = Base 1 JWT（共用登入）
    ▼
[Base 2 Edge: dawn-town-presence / dawn-town-transfer]
    │  只寫 svtkpdmqemidlasowqew
    ▼
[表: dawn_town_presence / dawn_town_buildings / dawn_town_transfers]
    │
    ├──►（進場）可選通知 Base 1 webhook／outbox：agent_left_base1_for_base2
    └──◄（離場）必須等 Base 1 ACK agent_returned_base1 才標 COMPLETE
```

### 2.1 誰擁有什麼

| 資料 | 擁有方 | 說明 |
|------|--------|------|
| 登入帳號／JWT | Base 1 Auth | 不另造 Auth |
| 城內 presence、所在建築、進／離城時間 | **Base 2 DB** | 真實列，不是只播動畫 |
| Gateway token 用量、日配額、耗盡標記 | **Base 1** `aivault_gateway_quota_events` 等 | Base 2 **不能**假裝自己算得準 |
| 調派／回歸協定事件 | 兩邊 outbox | 需父代理協調 Base 1 API |

### 2.2 關閉開關

- `localStorage.DAWN_TOWN_OFF=1` 或 `?dawn_town_off=1` 或 Edge `DAWN_TOWN_OFF=1`  
- 關閉時：UI 顯示「城鎮暫停」；不寫 DB；不發 transfer 事件。

---

## 3. 建築短名單（＝Base 2 專案）

| 建築 ID | 顯示名 | 對應現況頁／能力 | 誠實狀態 |
|---------|--------|------------------|----------|
| `plaza_sun` | 小太陽廣場（中心） | 地標／狀態機展示 | PLAN（scaffold 有占位） |
| `gate_north` | 北城門（往返主城） | transfer enter/leave | PLAN；需 Base 1 API |
| `b_jpg` | JPG 工作室 | `app/dawn-jpg-studio.html` | 頁面 AVAILABLE；建築狀態 PLAN |
| `b_voice` | 語音坊 | `app/dawn-voice-free.html` | 頁面 AVAILABLE_BROWSER；建築 PLAN |
| `b_music` | 歌唱坊 | `app/dawn-music-free.html` | EXPERIMENTAL_DSP；建築 PLAN |
| `b_video` | 短片坊 | `app/dawn-short-video-free.html` | AVAILABLE*；建築 PLAN |
| `b_media_hub` | 媒體中心 | `media.html` | 頁面 live；建築 PLAN |
| `b_qwen` | 曙光問答亭 | `dawn.html` + Qwen 任務 | 既有；建築 PLAN |
| `b_sandbox` | 圖生影片沙盒 | `dawn-sandbox.html` | **GATES_CLOSED**（展示封鎖，不呼叫） |
| `b_lab` | 研發公告板 | GitHub Issues／Draft PR | 外連；建築 PLAN |

禁止在城鎮 UI 把 `b_sandbox` 標成可生成。

---

## 4. 進場／離場協定（草圖）

### 4.1 進場（Base1 → Base2）

1. 使用者／代理人在 **Base 1** 點「前往曙光城」。  
2. Base 1 簽發短命 `transfer_ticket`（user_id、agent_id、purpose、exp、nonce）並標記本地 `location=in_transit_to_base2`。  
3. 瀏覽器打開 Base 2 `dawn-town.html?ticket=…`。  
4. Base 2 Edge 驗證 ticket（需 Base 1 JWKS／共享 HMAC——**阻斷項**）→ 寫入：
   - `dawn_town_presence`：`status=inside`, `building=plaza_sun`, `entered_at=now`
   - `dawn_town_transfers`：`direction=in`, `state=committed`
5. UI 播放「入城」動畫**僅在 DB commit 成功後**；失敗則停在城門外並顯示錯誤。  
6. （可選）Base 2 outbox 通知 Base 1：`arrived_base2`。

### 4.2 離場（Base2 → Base1）並讓創辦人看 token 耗盡

1. 使用者走到 `gate_north` 按「回主城」。  
2. Base 2 將 presence → `status=exiting`，播「出城門」動畫。  
3. Base 2 呼叫／佇列 **Base 1 return API**（阻斷項）：附上本趟 `transfer_id`、在城停留時長、於各建築的活動摘要（**不含**伪造配额）。  
4. Base 1 ACK 並把該主體 `location=base1`；可附帶 `quota_snapshot`（剩餘／耗盡的 provider 標記）。  
5. Base 2 收到 ACK 後才把 presence → `status=outside` 或刪列；UI 才允許「已回到主城」。  
6. 創辦人在 **Base 1 控制台**看 token 耗盡；Base 2 城鎮只顯示「本趟已回報／等待主城 ACK」，**不得**自行顯示假的 Gemini／Groq 餘額。

### 4.3 Base 2 能／不能顯示的配額

| 可顯示（自有） | 不可顯示（除非 Base 1 提供 API） |
|----------------|----------------------------------|
| 本城 presence 清單、進離時間 | Base 1 `aivault_gateway_quota_events` 精確剩餘 |
| 本城免費模組使用次數（若自建計數表） | Gemini／Groq／Magic Hour 日配額耗盡原因 |
| transfer 狀態：pending／acked／failed | 「暗星還剩多少 token」的權威數字 |

---

## 5. 建議資料表（尚未套用）

見 `docs/dawn-town/schema.proposed.sql`。  
**未執行 migration**；需另核准後再套到 `svtkpdmqemidlasowqew`。

---

## 6. UI／實作分期

| 階段 | 內容 | 成功標準 | 狀態 |
|------|------|----------|------|
| P0 | 本計畫 + scaffold 頁 + OFF 開關 | 文件合併；頁面明示 PLAN | **本輪** |
| P1 | 靜態地圖：小太陽中心 + 建築熱區連到現有免費頁 | 點建築進真實頁；無假 presence | 待核准 |
| P2 | `dawn_town_presence` migration + Edge upsert | 登入後心跳寫入 Base 2 表 | 待核准＋表建立 |
| P3 | 城門 transfer 協定 + Base 1 API | 進／離有雙邊事件；失敗可重試 | **阻斷：Base 1** |
| P4 | 人物精靈／工作動畫由 presence 驅動 | 無列則無「假人上班」 | 待 P2 |
| P5 | 創辦人儀表：誰在城、誰在等 ACK | 只讀 Base 2 transfer + Base 1 quota API | 待 Base 1 |

---

## 7. 父代理須協調的 Base 1 阻斷項

1. **`POST /town-transfer/issue`**：簽發短命 ticket（HMAC 或 JWT，含 user/agent/exp/nonce）。  
2. **`POST /town-transfer/ack-arrive`** 與 **`POST /town-transfer/ack-return`**：雙邊最終一致。  
3. **`GET /town-transfer/quota-snapshot?user_id=`**（或 agent）：回傳各 provider 剩餘／耗盡標記，供創辦人儀表；Base 2 只轉發顯示。  
4. **主城 UI「前往曙光城／已派出」** 狀態機，避免雙城同時標 inside。  
5. **不得**把 Base 1 私有 `agent-floor` HTML 整頁鏡射為曙光城；曙光城用 Base 2 自有頁。  
6. Presence 表若曾假設在 Base 2：目前 **不存在**，由 Base 2 新建 `dawn_town_*`，不要再誤用 `aivault_presence` 名稱以免與主城混淆。

---

## 8. 安全與成本

- `DAWN_TOWN_OFF=1` 可瞬斷。  
- 不呼叫 Magic Hour／Gemini Live／付費 TTS。  
- RLS：僅本人可寫自己的 presence；admin 可讀全城。  
- Ticket 單次使用、短 TTL、防重放（nonce 表）。

---

## 9. 本輪交付

- 本計畫：`/workspace/reports/base2-shuguang-town-plan.md` 與 `docs/dawn-town/PLAN.md`  
- Scaffold：`dawn-town.html` + `app/dawn-town/*`（明示 PLAN，OFF 開關）  
- SQL 草案：`docs/dawn-town/schema.proposed.sql`（**未套用**）  
- **不宣稱** presence／transfer／配額儀表 AVAILABLE
