# 曙光本地聊天與歌唱原型 v0.1

關聯 #15、#16。這是一套第二基地自行組合、實際在 CPU 執行的原型；聊天使用開放權重 Qwen3-0.6B，歌唱由本機 Flite 英文聲線與自行編寫的樂譜→WORLD 聲碼器流程產生。沒有外部 AI API 呼叫，不需 Gemini/Groq 金鑰。沒有從零訓練聊天或歌唱基礎模型。

## 已實測

| 能力 | 結果 | 證據 |
| --- | --- | --- |
| 權重下載／SHA256 | PASS | 官方 Qwen3-0.6B Q8，639,446,688 bytes；固定 SHA 見 evidence/benchmark.json |
| 模型載入 | PASS | llama.cpp b11669，固定版本／CPU／僅 loopback |
| 文字模型推論 | PASS | 2 次實際推論；17+25=42、疲累鼓勵；約 2.27 / 1.12 秒 |
| 本機 HTTP 聊天流程 | PASS | 本機頁面所用 /chat → Qwen →真實文字與 request ID |
| 樂譜歌唱 | EXPERIMENTAL | 原創英文四小節、16 音符、100 BPM、9.6 秒；產生人聲、伴奏、混音、MIDI、時間軸 |
| 音高客觀檢驗 | PASS（有限範圍） | 原創曲 16 個音符中段的 voiced-frame 中位 F0 誤差約 0.63–4.57 cents；不等於全時段／咬字自然度通過 |
| 單元／HTTP／合成測試 | PASS | 8 項，含真實合成與獨立 pitch tracker |
| 前端 JS 語法 | PASS | node --check local-ai/client.js |
| 端上介面、字幕、嘴型 | IMPLEMENTED_UNVERIFIED | WebAudio 分析真實播放音量；尚未瀏覽器／iPhone 實機測試 |
| 中文 TTS、ASR、完整語音聊天 | NOT_IMPLEMENTED | 目前只支援中文文字聊天、英文 TTS／歌唱 |
| 自訓練神經歌唱模型 | NOT_IMPLEMENTED | 本版為 score-controlled DSP，不稱為已訓練歌唱模型 |
| 雲端／第二基地公開網頁接通 | BLOCKED_NO_PERSISTENT_HOST | 本次為有限本地測試，未公開主機、未部署網站、未合併 main |
| ANN／ANCN／GPU 加速器 | NOT_IMPLEMENTED | 本版不冒稱有這些能力 |

聊天小模型可能算錯、混用簡繁體或回答不佳；兩次成功問答不代表通用正確率。歌聲的聽感、可懂度與自然度尚未人工驗收。音訊樣本已另外交付，SHA256 與完整量測在 evidence/benchmark.json。

## 在自己的 Linux x86_64 電腦運行

本版的固定 llama.cpp binary 僅適用 Linux x86_64。建議至少 4 GiB 可用 RAM、2 GiB 可用磁碟；這是安裝預檢建議，不是完整效能保證。手機與 GitHub Pages 無法直接執行此 Python/CPU 主機；iPhone 需後續 HTTPS 主機與權限部署，不能把 localhost 連結當作遠端入口。

需要 Python 3.12、FFmpeg（含 `flite` filter）、gcc/g++、venv。以 Ubuntu/Debian 為例，先用系統套件管理員安裝 python3-venv、python3-dev、ffmpeg、build-essential。不同平台需重新審核二進位與模型部署。

```bash
python3 -m venv .venv
. .venv/bin/activate
CXX=g++ CC=gcc python3 -m pip install -r local-ai/requirements.txt
python3 model/install-qwen.py --root /absolute/path/dawn-model-cache
python3 local-ai/run.py --model-root /absolute/path/dawn-model-cache
```

打開終端顯示的 `http://127.0.0.1:18180`。在「連線與能力」貼入主機私人檔案 `dawn-model-cache/dawn-ui-token` 的內容。這是自己主機產生的本機存取碼，不是第三方 API Key；不需要把它傳給 ChatGPT 或放進 GitHub。保持終端運作；Ctrl+C 結束會關閉模型。

UI 支援文字聊天、英文回覆朗讀、四小節原創曲演唱、下載 WAV/MIDI/時間軸、停止播放及取消。服務也接受自訂英文單字＋MIDI 樂譜，但不保證所有字的咬字自然。模型輸出中文時，英文朗讀會明確拒絕，不假裝支援中文聲線。

```bash
python3 -m unittest discover -s local-ai/tests -v
python3 local-ai/benchmark.py --model-root /absolute/path/dawn-model-cache --output /absolute/path/dawn-test-output
```

## API 與邊界

所有 mutation 需要本機 Bearer 存取碼。只接受本機 Host／Origin，拒絕跨站請求；不開公開 CORS。

- GET /health：模型即時健康、語音／歌唱／ASR 狀態，不回傳秘密。
- POST /chat：request_id(UUID)、message、history（最多 12 則）；回 text/model/provider_request_id/usage/latency。
- POST /speak：request_id、text；英文聲音 WAV base64，voice_id=flite-slt-en。
- POST /sing：request_id、score（rights=original/ licensed、tempo 50–180、最多 32 音符／30 秒、MIDI 48–84、英文單字）；回四軌素材與量測時間軸。
- POST /cancel：request_id；設定取消旗標。歌唱在音符間檢查；LLM 呼叫最長 60 秒，取消只丟棄該次結果，尚未實作 llama.cpp inference 的立即中斷。

HTTP 32 KiB body；2 個同時工作、每分鐘 20／每天 200 次（單一程序記憶體計數，重啟會重設，不是雲端持久化配額）。同 request_id 拒絕重複；不要在 timeout 後自動重送。沒有無限重連或付費 fallback。資料不送外部 AI，log 僅記 request_id／route／狀態／耗時，不記聊天文字或 token。對話暫存在目前頁面的記憶體，重新整理即清空。

## 來源與授權

- Qwen/Qwen3-0.6B-GGUF：Apache-2.0；revision、大小、SHA256 由既有 model/install-qwen.py 固定，下載與執行前檢查；沒有重分發權重到本 repo。
- ggml-org/llama.cpp：MIT；runtime 固定 b11669 與 SHA256。
- festvox/flite：保留其 COPYING 與各檔案授權；本次使用系統 libflite 的 slt 聲線，不提供／訓練指定真人歌手聲紋。若更換 voice，需逐一審核模型授權。
- JeremyCCHsu/Python-Wrapper-for-World-Vocoder／WORLD：MIT 與 modified BSD 相關授權；依安裝包保留原授權。
- NumPy / SciPy：BSD；FFmpeg 與 libflite 的具體編譯／連結授權由系統套件保留。本專案不捆綁它們的 binary。
- 原創曲《Dawn Shares the Light》歌詞與樂譜由本次專案建立；原始資料為 original-score.json。沒有重製既有版權歌曲。

官方來源：
https://huggingface.co/Qwen/Qwen3-0.6B-GGUF
https://github.com/ggml-org/llama.cpp
https://github.com/festvox/flite/blob/master/COPYING
https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder

下一階段需：實測並選定中文 ASR/TTS 模型、持久化工作佇列、串流與 barge-in、神經歌唱模型候選、iOS Safari 驗收、授權的常駐 HTTPS 主機。本版不修改既有首頁、主城、Supabase 或正式設定。
