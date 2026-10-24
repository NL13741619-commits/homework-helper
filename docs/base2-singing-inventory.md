# Base 2 歌唱／自然聲盤點與對齊報告

日期：2026-10-24 13:16（Asia/Taipei）  
倉庫：`NL13741619-commits/homework-helper`

## 1. 盤點表

| 項目 | 類型 | 狀態 | 說明 |
|------|------|------|------|
| Issue #22 短句唱歌教學 | GitHub Issue | OPEN / **NOT AVAILABLE**（產品） | 要求真實音高；禁 TTS 冒充。未合併實作到 main 產品聲 |
| Issue #23 聽音辨旋律升級 | Issue | OPEN / **NOT AVAILABLE** | 教學單 |
| Issue #24 聽歌學唱 P0 | Issue | OPEN / **NOT AVAILABLE** | 搜尋→旋律→對齊→演唱；未完成 |
| Issue #15/#19/#20 Voice Engine | Issue | OPEN | 自主語音／歌唱；Gemini Live 政策禁用 |
| `app/dawn-music-free.html` | 頁面 | **EXPERIMENTAL_DSP** | Web Audio 振盪器；**非產品歌唱聲** |
| `app/dawn-sing-ref.html` | 頁面（本輪） | **REFERENCE_PLAYBACK** | 自然 wav 原檔／抑揚／唱腔變形演示；**非神經唱** |
| `app/dawn-voice-free.html` | 頁面 | Web Speech **REJECTED**；wav **REFERENCE_WAV_READY** | 產品合成預設靜音 |
| `app/dawn-own-voice*.js/html` | 自建語音 | 產品 TTS **MUTED**／**PENDING_FREE_NEURAL_TTS** | 禁 Gemini Live |
| Draft PR #21 `feat/dawn-local-chat-sing` | local-ai Qwen+WORLD 四小節 | **DRAFT** / EXPERIMENTAL | 音高驗證過；未合併；非 Pages 產品 |
| Draft PR #25 `feat/dawn-melody-lyrics` | 旋律／押韻 | **DRAFT** | 未合併 |
| Draft PR #26 本地即時語音 | DRAFT | 未合併 |
| PR #27 免費媒體 | MERGED | JPG／DSP／Web Speech 實驗室 |
| PR #30 駁回電音合成 | MERGED | 產品聲靜音政策 |
| `app/services/aivault-voice` | Qwen3-TTS 部署程式 | **NOT_DEPLOYED** / **BLOCKED_NEED_GPU** | |
| Magic Hour／Gemini Live | — | **BLOCKED**／**DISABLED** | |

## 2. 自然參考 wav

| 欄位 | 值 |
|------|-----|
| 路徑（repo） | `app/assets/dawn-voice/dawn-natural-female-v2.wav` |
| 副本 | `/workspace/reports/dawn-voice/dawn-natural-female-v2.wav` |
| 來源附件 | parent agent attachments `75f94ca3…f108ce.wav`（同 SHA） |
| 格式 | PCM s16le，24000 Hz，mono，≈5.16 s，247560 bytes |
| SHA-256 | `75f94ca3ae9d8746f2bcf0c22e184fb146aceb3fb46279cee6045fe5a5f108ce` |
| 狀態 | **REFERENCE_WAV_READY**（可預覽參考錄音） |
| 正式即時 TTS | **PENDING_FREE_NEURAL_TTS**／**BLOCKED_NEED_GPU** — **非 AVAILABLE** |

## 3. 徽章／文案對齊（本輪）

| 位置 | Before（main 合併前） | After |
|------|----------------------|-------|
| media 語音 | PENDING_NATURAL_CLONE · wav MISSING | **REFERENCE_WAV_READY** + **PENDING_FREE_NEURAL_TTS**；Web Speech 仍 **已駁回** |
| media 歌唱 | 僅 DSP 實驗 | **REFERENCE_PLAYBACK** 連結 + DSP 非產品 + 產品唱 **NOT AVAILABLE** |
| dawn-voice-free | wav MISSING | 偵測 PRESENT → REFERENCE_WAV_READY；合成仍預設靜音 |
| dawn-sing-ref | （無） | 原檔／抑揚／唱腔變形三鍵，標 REFERENCE_PLAYBACK |

## 4. 免費演示路徑（已實作）

`app/dawn-free/reference-playback.js` + `app/dawn-sing-ref.html`：

1. 原檔播放（REFERENCE）  
2. playbackRate + gain 包絡 → 粗 **抑揚頓挫**（仍是同一段自然錄音）  
3. 音階比例逐步變形 → 「唱腔」演示  

誠實標籤：**REFERENCE_PLAYBACK** — 不是神經歌唱、不是產品 AVAILABLE。

## 5. 阻斷（給父代理）

1. **免費神經 TTS／歌唱**（Qwen3-TTS、CosyVoice 等）需 GPU／部署核准 → 否則無法「任意文本說＋唱」。  
2. Draft PR #21/#25 未合併；WORLD 聲碼器仍標 EXPERIMENTAL。  
3. 商業歌曲聽歌學唱（#24）另需授權音源政策。  
4. 不得重新啟用 Web Speech／振盪器當產品聲。

## 6. 政策不變

無付費 API、無 Gemini Live、image→video 閘關閉。
