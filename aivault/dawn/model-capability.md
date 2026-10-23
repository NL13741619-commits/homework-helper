# Dawn 影片模型能力層（第二基地）

控管者：dawn-light
目標：先產出 5 秒影片，再擴展至電視台節目／電影／新聞／連續劇。

## 能力（不寫死 provider）
- text_to_video_5s：文字→約 5 秒影片
- text_to_video：文字→影片（可變長度）
- image_to_video：參考圖→影片
- digital_human_speak：數字人開口／口型
- video_edit：剪輯、字幕、合成

## 執行原則
- 模型端點與授權由曙光在 runtime 讀取，不在此寫死
- 任務進 Issue #1，結果回 Issue #30
- 離線仍由 10 分鐘 tick 觸發
- 失敗時回報阻斷原因（無模型／無授權／配額），不假裝完成

## 電視台產出種類
- news_clip：新聞片段
- program_segment：節目段
- series_episode：連續劇單集
- film_scene：電影場景

先完成 text_to_video_5s，再逐步開啟其他種類。
