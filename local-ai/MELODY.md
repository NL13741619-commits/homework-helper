# 曙光旋律辨識、配詞與押韻 v0.2

本增量接續 local-ai v0.1。目標是先量測聲音的高低與快慢，再建立可修改的歌詞對齊資料；不以歌名搜尋結果代替音訊分析，也不宣稱任意完整歌曲均可準確重唱。

## 已完成程式與驗證

- `melody.py`：PCM16 mono/stereo WAV，1–30 秒，輸入大小／取樣率／靜音檢查。清唱以 WORLD Harvest 抓 F0；單旋律音源使用 normalized autocorrelation，依穩定音高分段，回 MIDI、音名、Hz、音符起訖與時值。
- 節奏模組從能量 onset 間隔提出 BPM 和半速／雙速候選；保留不確定性。這不是已驗證的拍號、重拍或變速偵測。
- 歌詞配置使用連續音符的 dynamic programming，把中文字／英文 token 對齊一個或多個音符，保留 melisma。一字多音可提出配置，字數多於音符會明確拒絕並要求手動拆分。沒有 ASR、音素 forced alignment、英文完整音節切分或中文聲調調整，不代表已讀懂原唱唱詞。
- 中文句尾押韻：以每句最後漢字的拼音韻母建立分組。例如「心／今」韻母都是 `in`，可以同組，不必寫成同一個字。近韻、方言、多音字及藝術上的押韻選擇仍要覆核；不強制更改使用者歌詞。
- `song_search.py`：透過 Wikimedia Commons 公開 API 搜尋音訊來源，回作品頁、授權標示與出處；真實查詢已返回 5 個候選。只搜尋目錄資料，沒有下載、分析或重製搜尋到的歌曲，搜尋到也不表示已辨識旋律。
- 新增 `/analyze`、`/rhymes`、`/song-search`，沿用本機 Bearer、來源、限流、並行與 request ID。前端加入來源搜尋、WAV 選擇、類型、歌詞、押韻及 JSON 匯出。
- 15 項測試通過（原 8 項＋7 項新測試）。包含實際生成的 8 音符音訊辨識：MIDI 60/62/64/65/67/69/71/72、120 BPM；本機 HTTP `/analyze` 串接真實處理與 8 字歌詞配置成功。證據為 `evidence/melody-benchmark.json`。這是受控波形，不是商業歌曲準確率。

## 使用

依 README 啟動本地主機，安裝更新後 requirements.txt（新增 `pypinyin==0.55.0`）。在頁面「辨識旋律與配歌詞」：

1. 可先搜尋歌名／主題，查看候選音訊來源頁與資訊。這不是全網歌庫，也不能保證找到任意歌名。
2. 提供適合分析的 1–30 秒 PCM16 WAV，選對單旋律／已分離人聲類型。
3. 填歌詞後分析，檢查音符高低、時值、BPM 候選與配詞提案。
4. 用句尾押韻報告檢查韻母分組，下載 JSON 作後續樂譜／歌聲模組輸入。

本版不接受伺服器任意音訊 URL，不會從第三方服務偷偷抓取完整歌曲。搜尋結果與分析素材分開，檔案由本地主機讀取使用者選定的音訊。前端結果含出處，但沒有主城金鑰或第三方 API Key。

## 明確未完成

完整伴奏歌曲的多音辨識、人聲／伴奏分離、歌曲身分匹配、網路音訊自動匯入、原唱歌詞轉寫、句子／音素級 forced alignment、變速曲精確拍點、中文歌唱與 melisma 實際合成、iPhone／瀏覽器實測及網站常駐部署尚未完成。

目前歌詞對齊只產生提案，不能把任意中文字直接送給現有英文 Flite 聲線就宣稱唱出中文；一字多音也仍需歌聲合成端配合。低音八度誤判、滑音、顫音、同音重複與背景噪音都可能需要人工修正。輸入標成 full_mix 時直接回 NEEDS_MELODY_SOURCE_SEPARATION，不把混音分析冒充正確主旋律。

研究來源：
- https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder
- https://pypinyin.readthedocs.io/zh-cn/master/api.html
- https://www.mediawiki.org/wiki/API:Search

沒有模型付費呼叫、沒有 main merge 或正式環境變更。
