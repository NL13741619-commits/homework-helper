# 第二基地完整移植

使用者於 2026-10-23 授權將主城登入、主頁、前後端與自主 AI 移植至第二基地。

目標：NL13741619-commits/homework-helper；Supabase：svtkpdmqemidlasowqew。
來源：m9wmtcb782-arch/AIVAULT。

驗收必須包含：第二基地登入與登出、主頁所有相依資源、獨立後端 schema/RLS/functions、第二基地模型真實推理、離線時任務接收與執行、持久記憶、GitHub 回報，以及可核對的端到端結果。

當前盤點：main 僅少量前端；feat/dawn-backend-construction 包含待整合後端、記憶、Qwen 主機與 runtime。現有 runtime 僅 memory_status/hash_text/qa；不具一般程式修改工具。歷史有限次 Qwen 測試不等於常駐模型部署。不得以心跳、mock 或靜態頁面宣稱自主 AI 完成。

狀態：IN_PROGRESS；尚未完成整體部署與自主 AI 驗收。保留現行第二基地登入；不覆寫安全團聚正式系統；不在前端或 git 存放 Secrets。
