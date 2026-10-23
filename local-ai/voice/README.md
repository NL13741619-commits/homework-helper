# 曙光持續收音／分段中文語音對話 v0.3

本版優先處理直接語音聊天。前端沒有文字輸入框、瀏覽器 SpeechRecognition、speechSynthesis 或字幕朗讀。你開一次麥克風後持續送 16 kHz PCM；本機服務聽懂後接話，回傳可播放的中文 PCM。字幕預設關閉，只是音訊流程的旁路顯示，關閉也不影響聲音。

內部仍是 **Whisper ASR → Qwen LLM → Kokoro 中文語音合成** 的串接式引擎，不宣稱已訓練原生端到端 speech-to-speech 基礎模型。把畫面上的字幕拿去朗讀，與本版的後端音訊路徑是不同實作。

## 行為

- 20ms PCM 連續上傳，能量 VAD 約 60ms 起說判斷、約 520ms 靜音結束，不需要逐句按送出。
- 麥克風在 AI 回答時繼續工作；偵測你插話就推進 turn epoch、清除播放佇列，舊 ASR/生成/TTS 即使稍後返回也丟棄，不混入新一輪。
- LLM 使用語音聊天提示，輸出短口語句；遇到逗號、問句、句號便分段合成，不等整篇回答完成。
- 使用同一個已驗證存在的本地 `zf_001` 中文聲線，不克隆使用者或歌手聲紋。模型語音韻律仍需聽感評估。
- iPhone 所需的手勢內 AudioContext 解鎖、AudioWorklet 重採樣、echoCancellation/noiseSuppression 請求、停止／離頁釋放麥克風與播放節點皆有程式。**尚未在真實 iPhone 或實體麥克風／喇叭驗證。**
- WebSocket 首訊息存取碼驗證，不把 token 放 URL；只綁 localhost，同源、2 sessions、單推論 worker、每 session 每分鐘 12 輪、10 分鐘上限、音訊格式／輸入流量限制、過慢輸出中止。API key 不存在於此路徑。

VAD 目前是自適應能量門檻，會受噪音、音量和殘留回音影響；不能把模擬測試當成真實全雙工或回音抑制驗收。中斷會立即停止客戶端排隊音訊並讓舊結果失效，但無法立即停止已進入 native runtime 的 CPU 推論；模型運算最多等待原工作返回。

## 真實測試與限制

`evidence/audio-transport.json` 記錄本機 WebSocket 的實際音訊流程：

- 合成測試問題：「曙光，我今天很累，想找你聊聊天。」
- 真實 Whisper 辨識：「樹光我今天很累,向著你聊聊天」——有專名與用詞錯誤，不報成逐字正確。
- 真實模型回答及中文聲音已回傳，最後一輪分 2 段聲音；輸入結束到首段 PCM 到達約 **2.586 秒**（包含約 0.52 秒停頓判定）。這不是瀏覽器喇叭首聲時間，也不是所有問題都能達成的保證。
- 前兩次開發迭代分別約 3.046／6.628 秒；設定有所改變，不可算成同一版本的 p95。單次 TTS CPU 比較發現 int8 export 在本機反而慢，已改用固定 SHA 的 float32 export，並在口語分句處提早合成。
- 14 項 protocol／WebSocket 測試通過：停頓、插話、舊音訊失效、PCM 格式、首訊息授權、Origin、分句與真實二進位音訊路徑的 mock 往返。模型 benchmark 使用真實 ASR/LLM/TTS；輸入聲音由同一語音模型合成，**不是獨立真人或麥克風測試**。
- 還沒有真人口音／噪音 WER、自然度盲測、實體回音與插話、長時間穩定性、iOS Safari 或公開網站驗收。故僅標記 **AUDIO_TRANSPORT_PASS**，不標記 **FLUENT_CONVERSATION_PASS**。

目前沒有外部 AI API 呼叫，沒有 production/Supabase 變更或常駐公開主機。GitHub Pages 不能執行這些本地模型；網址 localhost 只在運行它的電腦上有效。

## 可重現運行（Linux x86_64 / Python 3.12）

使用獨立 venv，避免覆蓋原歌唱實驗環境。系統需 python3-venv、python3-dev、gcc/g++。模型加 runtime 需數 GiB 磁碟空間；CPU效能會影響延遲。ASR MIT、Kokoro Apache-2.0、Qwen Apache-2.0；模型卡／程式庫其他依賴授權應保留。

```bash
python3 -m venv .voice-venv
. .voice-venv/bin/activate
python3 -m pip install -r local-ai/voice/requirements.txt
python3 model/install-qwen.py --root /absolute/path/dawn-model-cache
python3 local-ai/voice/install.py --root /absolute/path/dawn-voice-cache
python3 local-ai/voice/run.py --model-root /absolute/path/dawn-model-cache --voice-root /absolute/path/dawn-voice-cache
```

開啟 `http://127.0.0.1:18181`，輸入主機私人 `dawn-voice-ui-token` 檔案內容，點「開始語音」。不要將這個本機碼上傳 GitHub 或傳給別人。字幕預設關閉；請先用耳機測試，再測喇叭回音與插話。這項 localhost 配置不能直接拿 iPhone 遠端開啟；後續需要受保護的 HTTPS 主機部署。

```bash
PYTHONPATH=local-ai python3 -m unittest discover -s local-ai/voice -p 'test_*.py' -v
PYTHONPATH=local-ai python3 local-ai/voice/benchmark.py --model-root /absolute/path/dawn-model-cache --voice-root /absolute/path/dawn-voice-cache --output /absolute/path/voice-evidence
```

`dependencies-lock.txt` 是本次測試環境實際版本，頂層需求在 requirements.txt。權重依 model-lock.json 的固定 revision/URL/size/SHA256 下載並驗證；首次載入也重新核對。voicing export 的 `speed` 輸入 dtype 依 ONNX metadata 明確建立，避免上游 helper 的 int32/float32 不一致。

來源：
https://github.com/SYSTRAN/faster-whisper
https://huggingface.co/Systran/faster-whisper-base
https://github.com/thewh1teagle/kokoro-onnx
https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh

下一個驗收目標是：在真人連續對話中量測首聲／輪間延遲與錯誤率，確認不用字幕也能順暢接話，並真正通過插話、回音與手機測試。
