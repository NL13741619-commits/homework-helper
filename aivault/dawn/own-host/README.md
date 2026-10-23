# Dawn 自有圖生影片主機

第一能力：image_to_video_6s
控管者：dawn-light

## 啟動
在有 GPU 的主機上：

```sh
cd aivault/dawn/own-host
pip install -r requirements.txt
python host.py
```

預設聽 `0.0.0.0:7861`。
曙光 runtime 將 `ownEndpoint` 指向此位址。

## 呼叫
POST /produce
```json
{
  "kind": "image_to_video_6s",
  "prompt": "緩慢推近",
  "duration_sec": 6,
  "reference_image": "<base64 或 URL>"
}
```

回傳影片檔路徑或 base64。

## 現況
骨架已就位。實際推理需要在有 GPU 的主機跑起並載入開源圖生影片權重。
未跑起前，曙光會回 BLOCKED_NO_OWN_MODEL。
