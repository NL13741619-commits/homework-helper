# 第二基地 Qwen

在第二基地 GitHub Actions 的 CPU 執行 Qwen3-0.6B-Q8_0；使用固定 revision、模型及 llama.cpp SHA256 驗證。不是從零訓練的新基礎模型。

在本儲存庫 Issue 以 `/dawn 問題` 發文或留言，接受固定授權者 305579832 / 306819786 的指令。工作啟動後下載驗證模型、在 loopback 實際推理，以工作專用 GITHUB_TOKEN 回覆原 Issue。無需付費模型 API 金鑰。僅文字問答，不執行模型生成的 shell/code。

每工作最多 8 分鐘，最多 384 輸出 token，全庫單一並行工作。GitHub Actions 可能排隊或受帳戶額度、停用政策限制；不是 24 小時 HTTP 服務。併發大量指令可能受 GitHub concurrency 待執行工作限制；尚無持久佇列。

push / workflow_dispatch 執行真正的 17+25 推理驗收，未成功前不可宣稱線上模型已通過。已通過四項本地輸入授權測試。模型輸出不代表工具執行證據。
