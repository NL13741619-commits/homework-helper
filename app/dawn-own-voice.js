/**
 * Dawn own realtime voice (Base 2) — NO Gemini Live.
 * Off: ?voice=0 or localStorage DAWN_OWN_VOICE_OFF=1
 */
(function (root) {
  'use strict';

  var WAV_URL = new URL('assets/dawn-voice/dawn-natural-female-v2.wav', document.currentScript.src).href;
  var BRAIN = 'https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-brain-gateway';
  var FORBIDDEN = [
    'generativelanguage.googleapis.com',
    'BidiGenerateContent',
    'technical-dark-star-live-voice',
    'dawn-city-ai',
    'gemini-live',
    'dawn-light-video',
    'dawn-light-photo-video',
    'kling'
  ];

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
    if (/你好|嗨|哈囉|hello/i.test(t)) return '你好，我是曙光。這是第二基地自建語音測試，沒有使用 Gemini Live。';
    if (/你是誰|名字/.test(t)) return '我是曙光 Dawn Light。目前用臨時瀏覽器語音；認可女聲檔還沒放到倉庫。';
    if (/天氣|時間/.test(t)) return '我還沒接上氣象或時鐘服務，這句是 MOCK 回覆。';
    return '收到：「' + t.slice(0, 80) + '」。這是 MOCK 對話，不是 Gemini Live，也還不是認可音色。';
  }

  function DawnOwnVoice(ui) {
    this.ui = ui || {};
    this.active = false;
    this.starting = false;
    this.stream = null;
    this.rec = null;
    this.speaking = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 600;
    this.history = [];
    this.wavStatus = 'UNKNOWN';
    this.wavUrl = WAV_URL;
    this.mode = mockMode() ? 'MOCK' : 'AUTO';
    this.lastError = '';
  }

  DawnOwnVoice.prototype.setStatus = function (text, kind) {
    if (this.ui.onStatus) this.ui.onStatus(text, kind || 'info');
  };

  DawnOwnVoice.prototype.addLine = function (role, text, meta) {
    if (this.ui.onSubtitle) this.ui.onSubtitle(role, text, meta || {});
  };

  DawnOwnVoice.prototype.probeWav = async function () {
    try {
      assertNoLive(this.wavUrl);
      var r = await fetch(this.wavUrl, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) {
        this.wavStatus = 'PRESENT';
        return this.wavStatus;
      }
    } catch (e) {}
    this.wavStatus = 'MISSING';
    return this.wavStatus;
  };

  DawnOwnVoice.prototype.previewApprovedWav = async function () {
    if (this.wavStatus !== 'PRESENT') {
      this.setStatus('認可聲線檔仍 MISSING，無法預覽。', 'warn');
      return false;
    }
    return new Promise(function (resolve) {
      var a = new Audio(this.wavUrl);
      a.onended = function () { resolve(true); };
      a.onerror = function () { resolve(false); };
      a.play().catch(function () { resolve(false); });
    }.bind(this));
  };

  DawnOwnVoice.prototype.stopTts = function () {
    try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) {}
    this.speaking = false;
  };

  DawnOwnVoice.prototype.speak = function (text) {
    var self = this;
    this.stopTts();
    if (!root.speechSynthesis) {
      this.setStatus('此瀏覽器沒有 speechSynthesis，無法播放臨時語音。', 'err');
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(String(text || ''));
      u.lang = 'zh-TW';
      var v = pickZhVoice();
      if (v) u.voice = v;
      u.rate = 1.05;
      self.speaking = true;
      self.setStatus('曙光說話中（TEMPORARY TTS・非認可 v2 音色）', 'speak');
      u.onend = function () {
        self.speaking = false;
        if (self.active) self.setStatus('正在聆聽…', 'listen');
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
    if (!this.speaking) return;
    this.stopTts();
    this.setStatus('已插話中止播放（' + (reason || 'user') + '）', 'warn');
  };

  DawnOwnVoice.prototype.chat = async function (userText) {
    if (this.mode === 'MOCK' || mockMode()) {
      var m = mockReply(userText);
      return { content: m, source: 'MOCK', inference_executed: false };
    }
    // Optional free text via Base2 brain gateway — never Live.
    try {
      assertNoLive(BRAIN);
      var client = root.AIVAULT_AUTH_CLIENT;
      var token = null;
      if (client) {
        var sess = await client.auth.getSession();
        token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      }
      if (!token) {
        return { content: mockReply(userText) + '（未登入，回落 MOCK）', source: 'MOCK_NO_AUTH', inference_executed: false };
      }
      var r = await fetch(BRAIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'chat', agent_id: 'a1', userMessage: userText }),
        signal: AbortSignal.timeout(25000)
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok || !data.inference_executed || !data.content) {
        return {
          content: mockReply(userText) + '（大腦閘道不可用：' + (data.error || ('HTTP_' + r.status)) + '，回落 MOCK）',
          source: 'MOCK_BRAIN_FALLBACK',
          inference_executed: false
        };
      }
      return { content: data.content, source: 'BRAIN_GATEWAY', model: data.model, inference_executed: true };
    } catch (e) {
      return { content: mockReply(userText) + '（' + (e.message || e) + '，回落 MOCK）', source: 'MOCK_ERROR', inference_executed: false };
    }
  };

  DawnOwnVoice.prototype.handleUtterance = async function (text) {
    var t = String(text || '').trim();
    if (!t) return;
    this.bargeIn('new-utterance');
    this.addLine('user', t, {});
    this.history.push({ role: 'user', text: t });
    this.setStatus('曙光思考中…', 'think');
    var ans = await this.chat(t);
    this.addLine('dawn', ans.content, { source: ans.source, model: ans.model || null });
    this.history.push({ role: 'dawn', text: ans.content, source: ans.source });
    await this.speak(ans.content);
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
      self.setStatus('語音辨識錯誤：' + self.lastError + '（可改打字）', 'err');
      if (self.active) self._scheduleReconnect();
    };
    rec.onend = function () {
      if (self.active) self._scheduleReconnect();
    };
    return rec;
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
          try { self.rec.start(); self.reconnectDelay = 600; self.setStatus('已重連聆聽', 'listen'); }
          catch (e) {
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
      if (!root.navigator || !root.navigator.mediaDevices || !root.navigator.mediaDevices.getUserMedia) {
        throw new Error('此瀏覽器不支援麥克風');
      }
      this.stream = await root.navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      var Rec = SpeechRec();
      if (!Rec) {
        this.setStatus('STT 不支援：NOT LIVE，請用下方打字（麥克風已開，僅佔用裝置）', 'warn');
        this.active = true;
        this.starting = false;
        return true;
      }
      this.rec = this._bindRec();
      this.rec.start();
      this.active = true;
      this.starting = false;
      var wavNote = this.wavStatus === 'PRESENT' ? '認可 wav 可預覽' : '認可 wav=MISSING・臨時 TTS';
      this.setStatus('正在聆聽（非 Gemini Live・' + wavNote + '・模式 ' + this.mode + '）', 'listen');
      return true;
    } catch (e) {
      this.starting = false;
      await this.stop(false);
      this.setStatus('啟動失敗：' + (e.message || e), 'err');
      return false;
    }
  };

  DawnOwnVoice.prototype.stop = async function (show) {
    this.active = false;
    this.starting = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.stopTts();
    try { if (this.rec) { this.rec.onend = null; this.rec.onerror = null; this.rec.stop(); } } catch (e) {}
    this.rec = null;
    if (this.stream) {
      try { this.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
      this.stream = null;
    }
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
    wavPath: 'app/assets/dawn-voice/dawn-natural-female-v2.wav',
    offSwitch: '?voice=0 or localStorage.DAWN_OWN_VOICE_OFF=1',
    forbidden: FORBIDDEN.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
