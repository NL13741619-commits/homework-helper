/**
 * Dawn own realtime voice (Base 2) — NO Gemini Live.
 *
 * Pipeline (Gemini Live–inspired specs, not Google dependency):
 *   mic PCM → energy VAD / silence EOT (500–800ms) → STT (Web Speech, honest label)
 *   → dialogue (brain gateway if logged in, else clear error / MOCK)
 *   → neural TTS when READY else MUTED (never browser 電音 as product)
 *
 * Product TTS policy (2026-10-24): Web Speech / speechSynthesis REJECTED.
 * Off: ?voice=0 or localStorage DAWN_OWN_VOICE_OFF=1
 * Debug-only synth (never product): ?synth=1 — still labeled REJECTED.
 * Mock dialogue: ?mock=1
 */
(function (root) {
  'use strict';

  var BRAIN = 'https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-brain-gateway';
  var FORBIDDEN = [
    'generativelanguage.googleapis.com',
    'BidiGenerateContent',
    'technical-dark-star-live-voice',
    'dawn-city-ai',
    'gemini-live',
    'dawn-light-video',
    'dawn-light-photo-video',
    'kling',
    'magichour'
  ];

  /** Specs from learn-gemini-live-voice.md */
  var SPEC = {
    inputHz: 16000,
    chunkMs: 30,
    silenceEotMs: 700,
    silenceEotMinMs: 500,
    silenceEotMaxMs: 800,
    prefixPaddingMs: 20,
    energySpeechThreshold: 0.02,
    energySilenceThreshold: 0.01
  };

  function off() {
    try {
      if (/[?&]voice=0(?:&|$)/.test(location.search)) return true;
      if (localStorage.getItem('DAWN_OWN_VOICE_OFF') === '1') return true;
    } catch (e) {}
    return false;
  }

  function mockMode() {
    return /[?&]mock=1(?:&|$)/.test(location.search);
  }

  function debugSynthAllowed() {
    return /[?&]synth=1(?:&|$)/.test(location.search);
  }

  function assertNoLive(url) {
    var s = String(url || '');
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (s.indexOf(FORBIDDEN[i]) !== -1) throw new Error('BLOCKED_GEMINI_LIVE_OR_FORBIDDEN:' + FORBIDDEN[i]);
    }
  }

  function SpeechRec() {
    return root.SpeechRecognition || root.webkitSpeechRecognition || null;
  }

  function pickZhVoice() {
    var list = (root.speechSynthesis && root.speechSynthesis.getVoices()) || [];
    var prefer = list.filter(function (v) {
      return /zh(-|_)?(TW|HK|CN)?/i.test(v.lang) && /female|女|Mei|Ting|Han|Lin|Yaoyao|Hui|Xiaoxiao/i.test(v.name + v.voiceURI);
    });
    if (prefer[0]) return prefer[0];
    var zh = list.filter(function (v) { return /zh/i.test(v.lang); });
    return zh[0] || list[0] || null;
  }

  function mockReply(text) {
    var t = String(text || '').trim();
    if (!t) return '我在聽，請再說一次。';
    if (/你好|嗨|哈囉|hello/i.test(t)) {
      return '你好，我是曙光。這是第二基地自建語音測試，沒有使用 Gemini Live。產品音色尚未接通：說話參考仍為 dawn-natural-female-v2.wav；影片清唱僅作唱歌音律參考；自然神經 TTS 仍需 GPU。';
    }
    if (/你是誰|名字/.test(t)) {
      return '我是曙光 Dawn Light。瀏覽器合成聲已被拒絕當產品音色；認可女聲檔與神經 TTS 尚未就緒。';
    }
    if (/天氣|時間/.test(t)) return '我還沒接上氣象或時鐘服務，這句是 MOCK 回覆。';
    return '收到：「' + t.slice(0, 80) + '」。這是 MOCK 對話，不是 Gemini Live，也不是認可自然女聲。';
  }

  /**
   * Energy-based VAD + silence EOT (client-side), Gemini Live–style timings.
   */
  function EnergyVad(stream, opts) {
    opts = opts || {};
    this.silenceEotMs = Math.min(
      SPEC.silenceEotMaxMs,
      Math.max(SPEC.silenceEotMinMs, opts.silenceEotMs || SPEC.silenceEotMs)
    );
    this.onSpeechStart = opts.onSpeechStart || function () {};
    this.onEot = opts.onEot || function () {};
    this.onLevel = opts.onLevel || function () {};
    this._active = false;
    this._inSpeech = false;
    this._silenceMs = 0;
    this._raf = null;
    this._ctx = null;
    this._analyser = null;
    this._source = null;
    this._data = null;
    this._lastTs = 0;
    this._stream = stream;
  }

  EnergyVad.prototype.start = function () {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    this._ctx = new AC();
    this._source = this._ctx.createMediaStreamSource(this._stream);
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    this._source.connect(this._analyser);
    this._data = new Uint8Array(this._analyser.fftSize);
    this._active = true;
    this._lastTs = performance.now();
    var self = this;
    function tick(now) {
      if (!self._active) return;
      self._analyser.getByteTimeDomainData(self._data);
      var sum = 0;
      for (var i = 0; i < self._data.length; i++) {
        var v = (self._data[i] - 128) / 128;
        sum += v * v;
      }
      var rms = Math.sqrt(sum / self._data.length);
      self.onLevel(rms);
      var dt = Math.min(80, now - self._lastTs);
      self._lastTs = now;
      if (rms >= SPEC.energySpeechThreshold) {
        if (!self._inSpeech) {
          self._inSpeech = true;
          self.onSpeechStart({ rms: rms });
        }
        self._silenceMs = 0;
      } else if (self._inSpeech) {
        if (rms <= SPEC.energySilenceThreshold) {
          self._silenceMs += dt;
          if (self._silenceMs >= self.silenceEotMs) {
            self._inSpeech = false;
            var waited = self._silenceMs;
            self._silenceMs = 0;
            self.onEot({ silenceMs: waited });
          }
        }
      }
      self._raf = root.requestAnimationFrame(tick);
    }
    this._raf = root.requestAnimationFrame(tick);
    return true;
  };

  EnergyVad.prototype.stop = function () {
    this._active = false;
    if (this._raf) {
      try { root.cancelAnimationFrame(this._raf); } catch (e) {}
      this._raf = null;
    }
    try { if (this._source) this._source.disconnect(); } catch (e2) {}
    try { if (this._ctx) this._ctx.close(); } catch (e3) {}
    this._source = null;
    this._analyser = null;
    this._ctx = null;
  };

  function DawnOwnVoice(ui) {
    this.ui = ui || {};
    this.active = false;
    this.starting = false;
    this.stream = null;
    this.rec = null;
    this.vad = null;
    this.speaking = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 600;
    this.history = [];
    this.mode = mockMode() ? 'MOCK' : 'AUTO';
    this.lastError = '';
    this.ttsPolicy = 'MUTED_WAITING_NATURAL_TTS';
    this.abortChat = null;
    this.phase = 'IDLE'; // IDLE|LISTEN|SPEECH|EOT|THINK|SPEAK_MUTED|ERROR
    this.metrics = {
      bargeInCount: 0,
      eotCount: 0,
      utterances: 0,
      lastSilenceMs: null,
      lastThinkMs: null,
      lastTtfSubtitleMs: null
    };
    this.neural = null;
    this.neuralStatus = null;
    try {
      if (root.DawnNeuralTts) this.neural = new root.DawnNeuralTts();
    } catch (e) {}
  }

  DawnOwnVoice.prototype.setStatus = function (text, kind) {
    if (this.ui.onStatus) this.ui.onStatus(text, kind || 'info');
  };

  DawnOwnVoice.prototype.setPhase = function (phase) {
    this.phase = phase;
    if (this.ui.onPhase) this.ui.onPhase(phase, this.metrics);
  };

  DawnOwnVoice.prototype.addLine = function (role, text, meta) {
    if (this.ui.onSubtitle) this.ui.onSubtitle(role, text, meta || {});
  };

  DawnOwnVoice.prototype.emitMetrics = function () {
    if (this.ui.onMetrics) this.ui.onMetrics(Object.assign({}, this.metrics, { phase: this.phase }));
  };

  DawnOwnVoice.prototype.probeWav = async function () {
    if (!this.neural) {
      this.neuralStatus = {
        wavStatus: 'MISSING',
        engineStatus: 'MUTED_WAITING_WAV',
        productPlayback: false,
        reason: 'DawnNeuralTts adapter not loaded'
      };
      return 'MISSING';
    }
    this.neuralStatus = await this.neural.probe();
    return this.neuralStatus.wavStatus;
  };

  DawnOwnVoice.prototype.acceptWavFile = async function (file) {
    if (!this.neural) throw new Error('NO_NEURAL_ADAPTER');
    this.neuralStatus = await this.neural.acceptWavFile(file);
    if (this.ui.onNeural) this.ui.onNeural(this.neuralStatus);
    return this.neuralStatus;
  };

  DawnOwnVoice.prototype.clearDroppedWav = async function () {
    if (!this.neural) return null;
    this.neuralStatus = await this.neural.clearDroppedWav();
    if (this.ui.onNeural) this.ui.onNeural(this.neuralStatus);
    return this.neuralStatus;
  };

  DawnOwnVoice.prototype.previewApprovedWav = async function () {
    if (!this.neural) {
      this.setStatus('神經 TTS 轉接器未載入。', 'warn');
      return false;
    }
    await this.probeWav();
    if (!this.neuralStatus || String(this.neuralStatus.wavStatus).indexOf('PRESENT') !== 0) {
      this.setStatus('說話克隆錨點仍 MISSING。請確認 dawn-natural-female-v2.wav 或投放說話 wav。', 'warn');
      return false;
    }
    var ok = await this.neural.previewReference();
    if (!ok) this.setStatus('參考 wav 預覽失敗。', 'err');
    return ok;
  };

  DawnOwnVoice.prototype.stopTts = function () {
    try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) {}
    try { if (this.neural) this.neural.bargeInFlush(); } catch (e2) {}
    this.speaking = false;
  };

  DawnOwnVoice.prototype.cancelInFlight = function (reason) {
    if (this.abortChat) {
      try { this.abortChat.abort(reason || 'barge-in'); } catch (e) {}
      this.abortChat = null;
    }
  };

  /**
   * Product speak path: NEVER play browser speechSynthesis as Dawn voice.
   * Subtitles remain; optional ?synth=1 plays REJECTED debug synth only.
   * Neural path used when adapter reports READY (not yet on this box).
   */
  DawnOwnVoice.prototype.speak = async function (text) {
    var self = this;
    this.stopTts();
    var msg = String(text || '');

    // Try neural product path first
    if (this.neural) {
      var neuralResult = await this.neural.speak(msg);
      this.neuralStatus = neuralResult.status || this.neuralStatus;
      if (neuralResult.played) {
        this.speaking = true;
        this.ttsPolicy = 'NEURAL_PLAYING';
        this.setPhase('SPEAK');
        this.speaking = false;
        return true;
      }
    }

    if (!debugSynthAllowed()) {
      this.speaking = false;
      this.ttsPolicy = 'MUTED_WAITING_NATURAL_TTS';
      this.setPhase('SPEAK_MUTED');
      var why = (this.neuralStatus && this.neuralStatus.reason) || 'WAITING_WAV_AND_NEURAL_TTS';
      this.setStatus(
        '字幕已顯示 · 產品播音靜音（' + why + '）· 拒絕瀏覽器電音合成',
        'warn'
      );
      if (this.ui.onTtsPolicy) {
        this.ui.onTtsPolicy({
          productPlayback: false,
          reason: this.ttsPolicy,
          neural: this.neuralStatus,
          waitingFor: ['dawn-natural-female-v2.wav', 'free_neural_tts_GPU_or_host']
        });
      }
      return false;
    }

    // Debug-only path — explicitly not product voice.
    if (!root.speechSynthesis) {
      this.setStatus('?synth=1 但此瀏覽器沒有 speechSynthesis（仍非產品音色）。', 'err');
      return false;
    }
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(msg);
      u.lang = 'zh-TW';
      var v = pickZhVoice();
      if (v) u.voice = v;
      u.rate = 1.05;
      self.speaking = true;
      self.ttsPolicy = 'DEBUG_SYNTH_REJECTED_AS_PRODUCT';
      self.setPhase('SPEAK');
      self.setStatus('DEBUG 合成聲播放中（REJECTED・非曙光產品音色・非認可 v2）', 'speak');
      u.onend = function () {
        self.speaking = false;
        if (self.active) {
          self.setPhase('LISTEN');
          self.setStatus('正在聆聽…（產品播音仍未接通）', 'listen');
        }
        resolve(true);
      };
      u.onerror = function () {
        self.speaking = false;
        resolve(false);
      };
      root.speechSynthesis.speak(u);
    });
  };

  DawnOwnVoice.prototype.bargeIn = function (reason) {
    var did = false;
    if (this.speaking || (this.neural && this.neural.queue && this.neural.queue.playing)) {
      did = true;
    }
    this.stopTts();
    this.cancelInFlight(reason || 'barge-in');
    if (did || reason) {
      this.metrics.bargeInCount += 1;
      this.emitMetrics();
      this.setStatus('已插話中止（' + (reason || 'user') + '）· 播放佇列已清空', 'warn');
    }
  };

  DawnOwnVoice.prototype.chat = async function (userText) {
    if (this.mode === 'MOCK' || mockMode()) {
      return { content: mockReply(userText), source: 'MOCK', inference_executed: false };
    }
    this.abortChat = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var signal = this.abortChat ? this.abortChat.signal : undefined;
    try {
      assertNoLive(BRAIN);
      var client = root.AIVAULT_AUTH_CLIENT;
      var token = null;
      if (client) {
        var sess = await client.auth.getSession();
        token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      }
      if (!token) {
        return {
          content: '未登入第二基地帳號：無法呼叫 aivault-brain-gateway。請登入後重試，或使用 ?mock=1 測字幕流程。',
          source: 'ERROR_NO_AUTH',
          inference_executed: false,
          error: 'NO_AUTH'
        };
      }
      var r = await fetch(BRAIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'chat', agent_id: 'a1', userMessage: userText }),
        signal: signal || AbortSignal.timeout(25000)
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok || !data.inference_executed || !data.content) {
        return {
          content: '大腦閘道不可用：' + (data.error || ('HTTP_' + r.status)) + '。未偷偷改走付費 API。',
          source: 'ERROR_BRAIN',
          inference_executed: false,
          error: data.error || ('HTTP_' + r.status)
        };
      }
      return { content: data.content, source: 'BRAIN_GATEWAY', model: data.model, inference_executed: true };
    } catch (e) {
      if (e && (e.name === 'AbortError' || String(e.message || '').indexOf('aborted') >= 0)) {
        return { content: '', source: 'ABORTED', inference_executed: false, error: 'ABORTED' };
      }
      return {
        content: '對話失敗：' + (e.message || e) + '。未呼叫 Gemini Live／付費 API。',
        source: 'ERROR_NETWORK',
        inference_executed: false,
        error: String(e.message || e)
      };
    } finally {
      this.abortChat = null;
    }
  };

  DawnOwnVoice.prototype.handleUtterance = async function (text) {
    var t = String(text || '').trim();
    if (!t) return;
    this.bargeIn('new-utterance');
    this.metrics.utterances += 1;
    var t0 = performance.now();
    this.addLine('user', t, {});
    this.history.push({ role: 'user', text: t });
    this.setPhase('THINK');
    this.setStatus('曙光思考中…', 'think');
    var ans = await this.chat(t);
    this.metrics.lastThinkMs = Math.round(performance.now() - t0);
    if (ans.source === 'ABORTED' || !ans.content) {
      this.emitMetrics();
      if (this.active) {
        this.setPhase('LISTEN');
        this.setStatus('已中止，繼續聆聽', 'listen');
      }
      return;
    }
    var ttsLabel =
      this.neuralStatus && this.neuralStatus.engineStatus === 'READY'
        ? 'NEURAL'
        : 'MUTED_' + ((this.neuralStatus && this.neuralStatus.engineStatus) || 'WAITING');
    this.addLine('dawn', ans.content, {
      source: ans.source,
      model: ans.model || null,
      tts: ttsLabel,
      thinkMs: this.metrics.lastThinkMs
    });
    this.metrics.lastTtfSubtitleMs = Math.round(performance.now() - t0);
    this.emitMetrics();
    this.history.push({ role: 'dawn', text: ans.content, source: ans.source });
    await this.speak(ans.content);
    if (this.active && this.phase === 'SPEAK_MUTED') {
      this.setPhase('LISTEN');
      this.setStatus('正在聆聽（產品播音仍靜音）', 'listen');
    }
  };

  DawnOwnVoice.prototype._bindRec = function () {
    var Rec = SpeechRec();
    if (!Rec) return null;
    var rec = new Rec();
    rec.lang = 'zh-TW';
    rec.continuous = true;
    rec.interimResults = true;
    var self = this;
    var interim = '';
    rec.onresult = function (ev) {
      var finalText = '';
      interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && self.ui.onInterim) self.ui.onInterim(interim);
      if (interim && self.speaking) self.bargeIn('interim-speech');
      if (finalText) self.handleUtterance(finalText);
    };
    rec.onerror = function (ev) {
      self.lastError = ev.error || 'stt-error';
      self.setStatus('語音辨識錯誤：' + self.lastError + '（可改打字；STT=Web Speech 僅辨識）', 'err');
      if (self.active) self._scheduleReconnect();
    };
    rec.onend = function () {
      if (self.active) self._scheduleReconnect();
    };
    return rec;
  };

  DawnOwnVoice.prototype._bindVad = function () {
    var self = this;
    if (!this.stream) return null;
    var vad = new EnergyVad(this.stream, {
      silenceEotMs: SPEC.silenceEotMs,
      onSpeechStart: function () {
        if (self.speaking) self.bargeIn('vad-speech-start');
        if (self.phase === 'LISTEN' || self.phase === 'SPEAK_MUTED') self.setPhase('SPEECH');
      },
      onEot: function (info) {
        self.metrics.eotCount += 1;
        self.metrics.lastSilenceMs = info.silenceMs;
        self.emitMetrics();
        if (self.ui.onEot) self.ui.onEot(info);
        // STT final result still drives utterance; EOT is timing/metrics + future PCM cut.
        if (self.phase === 'SPEECH') self.setPhase('EOT');
      },
      onLevel: function (rms) {
        if (self.ui.onLevel) self.ui.onLevel(rms);
      }
    });
    return vad;
  };

  DawnOwnVoice.prototype._scheduleReconnect = function () {
    var self = this;
    if (!this.active || this.reconnectTimer) return;
    var delay = Math.min(this.reconnectDelay || 600, 4000);
    this.reconnectTimer = setTimeout(function () {
      self.reconnectTimer = null;
      if (!self.active) return;
      try {
        if (self.rec) {
          try {
            self.rec.start();
            self.reconnectDelay = 600;
            self.setPhase('LISTEN');
            self.setStatus('已重連聆聽', 'listen');
          } catch (e) {
            self.reconnectDelay = Math.min((self.reconnectDelay || 600) * 2, 4000);
            self._scheduleReconnect();
          }
        }
      } catch (e2) {
        self._scheduleReconnect();
      }
    }, delay);
  };

  DawnOwnVoice.prototype.start = async function () {
    if (off()) {
      this.setStatus('自建語音已關閉（?voice=0 或 DAWN_OWN_VOICE_OFF=1）', 'warn');
      return false;
    }
    if (this.active || this.starting) return false;
    this.starting = true;
    try {
      await this.probeWav();
      if (this.ui.onNeural) this.ui.onNeural(this.neuralStatus);
      if (!root.navigator || !root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) {
        throw new Error('此瀏覽器不支援麥克風');
      }
      this.stream = await root.navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      this.vad = this._bindVad();
      if (this.vad) this.vad.start();

      var Rec = SpeechRec();
      if (!Rec) {
        this.setStatus('STT 不支援：請用下方打字（麥克風＋VAD 已開；產品 TTS 仍靜音）', 'warn');
        this.active = true;
        this.starting = false;
        this.setPhase('LISTEN');
        return true;
      }
      this.rec = this._bindRec();
      this.rec.start();
      this.active = true;
      this.starting = false;
      this.setPhase('LISTEN');
      var wavNote =
        this.neuralStatus && String(this.neuralStatus.wavStatus).indexOf('PRESENT') === 0
          ? '認可 wav=' + this.neuralStatus.wavStatus + '（神經 TTS 仍 ' + this.neuralStatus.engineStatus + '）'
          : '認可 wav=MISSING・產品播音靜音';
      this.setStatus(
        '正在聆聽（非 Gemini Live・VAD EOT=' + SPEC.silenceEotMs + 'ms・' + wavNote + '・模式 ' + this.mode + '）',
        'listen'
      );
      return true;
    } catch (e) {
      this.starting = false;
      await this.stop(false);
      this.setPhase('ERROR');
      this.setStatus('啟動失敗：' + (e.message || e), 'err');
      return false;
    }
  };

  DawnOwnVoice.prototype.stop = async function (show) {
    this.active = false;
    this.starting = false;
    this.cancelInFlight('stop');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopTts();
    try {
      if (this.vad) this.vad.stop();
    } catch (e0) {}
    this.vad = null;
    try {
      if (this.rec) {
        this.rec.onend = null;
        this.rec.onerror = null;
        this.rec.stop();
      }
    } catch (e) {}
    this.rec = null;
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e2) {}
      this.stream = null;
    }
    try {
      if (this.neural) this.neural.stop();
    } catch (e3) {}
    this.setPhase('IDLE');
    if (show !== false) this.setStatus('已結束並釋放麥克風', 'info');
  };

  DawnOwnVoice.prototype.sendText = async function (text) {
    if (off()) {
      this.setStatus('自建語音已關閉', 'warn');
      return;
    }
    await this.handleUtterance(text);
  };

  root.DawnOwnVoice = DawnOwnVoice;
  root.DawnOwnVoiceMeta = {
    geminiLive: false,
    productTts: 'MUTED_UNTIL_NATURAL_NEURAL',
    approvedPath: 'speak: dawn-natural-female-v2.wav + free neural TTS; melody: dawn-singing-melody-ref-v1.wav (Option B, not speak TARGET)',
    wavPath: 'app/assets/dawn-voice/dawn-natural-female-v2.wav',
    melodyWavPath: 'app/assets/dawn-voice/dawn-singing-melody-ref-v1.wav',
    legacyWavPath: 'app/assets/dawn-voice/dawn-natural-female-v2.wav',
    eotAsset: 'app/assets/dawn-voice/aivault-eot-v1-int8.onnx',
    offSwitch: '?voice=0 or localStorage.DAWN_OWN_VOICE_OFF=1',
    debugSynth: '?synth=1 (REJECTED as product voice)',
    spec: SPEC,
    forbidden: FORBIDDEN.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
