# 第二基地生成服務

已部署：dawn-light-video、dawn-light-photo-video、dawn-light-talking-photo。

狀態：缺少 MAGIC_HOUR_API_KEY，尚未發出模型生成請求。未修改 Secrets、未啟用付費。金鑰僅存第二基地 Supabase Secrets。

生成另受既有 PAID_API_ALLOW 控制：短片 magic_hour_video；數字人 magic_hour_talking_photo。PAID_API_KILL=1 停止呼叫。本工程未啟用任何授權旗標。

POST 僅接受第二基地 Session，重新 getUser 確認 app_metadata.role=owner/admin；不信任可編輯的 user_metadata。CORS 僅第二基地站台。Talking Photo 需生成服務上傳後的 image_file_path/audio_file_path，最長5秒。未知請求結果不自動重送。

權限測試：無Session拒絕、可編輯角色升權拒絕、伺服器確認owner才接受，三項通過。這些不是生成模型驗收。
