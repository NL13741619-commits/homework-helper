/**
 * Dawn neural TTS adapter (Base 2) — product path only.
 * NEVER uses browser speechSynthesis as product voice.
 * NEVER calls Gemini Live / paid Grok / Kling / Magic Hour.
 *
 * States:
 *  - MUTED_WAITING_WAV: no approved reference wav
 *  - BLOCKED_NEED_GPU: wav may exist but Qwen3-TTS / CosyVoice need GPU (box has none)
 *  - READY: future — local free neural endpoint returns audio chunks
 */
(function (root) {
  'use strict';

  var IDB_NAME = 'dawn-voice-v1';
  var IDB_STORE = 'refs';
  var IDB_KEY = 'dawn-natural-female-v2';
  /** NEW realtime speaking TARGET (user video audio, 2026-10-24). */
  var ASSET_TARGET_WAV = 'assets/dawn-voice/dawn-realtime-target-v1.wav';
  /** Earlier short reference — keep; do not delete. */
  var ASSET_LEGACY_WAV = 'assets/dawn-voice/dawn-natural-female-v2.wav';
  /** Primary clone anchor for future neural TTS = realtime target. */
  var ASSET_WAV = ASSET_TARGET_WAV;
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

  function assertNoForbidden(url) {
    var s = String(url || '');
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (s.toLowerCase().indexOf(FORBIDDEN[i]) !== -1) {
        throw new Error('BLOCKED_FORBIDDEN:' + FORBIDDEN[i]);
      }
    }
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error('NO_INDEXEDDB'));
      var req = root.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IDB_OPEN_FAIL')); };
    });
  }

  function idbGet() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var g = tx.objectStore(IDB_STORE).get(IDB_KEY);
        g.onsuccess = function () { resolve(g.result || null); };
        g.onerror = function () { reject(g.error); };
      });
    }).catch(function () { return null; });
  }

  function idbPut(record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(record, IDB_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbClear() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () { return false; });
  }

  function sha256Hex(buf) {
    if (!root.crypto || !root.crypto.subtle) {
      return Promise.resolve(null);
    }
    return root.crypto.subtle.digest('SHA-256', buf).then(function (d) {
      var a = new Uint8Array(d);
      var s = '';
      for (var i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, '0');
      return s;
    });
  }

  function resolveAssetUrl(rel) {
    var path = rel || ASSET_WAV;
    try {
      if (document.currentScript && document.currentScript.src) {
        return new URL(path, document.currentScript.src).href;
      }
    } catch (e) {}
    try {
      return new URL(path, root.location.href).href;
    } catch (e2) {
      return path;
    }
  }

  /**
   * Simple PCM / AudioBuffer playback queue with barge-in flush.
   */
  function PcmPlayQueue(opts) {
    this.ctx = null;
    this.queue = [];
    this.playing = false;
    this.current = null;
    this.onState = (opts && opts.onState) || function () {};
  }

  PcmPlayQueue.prototype._ensure = function () {
    if (!this.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('NO_AUDIO_CONTEXT');
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  };

  PcmPlayQueue.prototype.enqueueBuffer = function (audioBuffer) {
    this.queue.push(audioBuffer);
    this._pump();
  };

  PcmPlayQueue.prototype.enqueueArrayBuffer = async function (ab, mimeHint) {
    var ctx = this._ensure();
    var buf = await ctx.decodeAudioData(ab.slice(0));
    this.enqueueBuffer(buf);
  };

  PcmPlayQueue.prototype._pump = function () {
    if (this.playing) return;
    if (!this.queue.length) {
      this.onState({ playing: false, queued: 0 });
      return;
    }
    var ctx = this._ensure();
    var buf = this.queue.shift();
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    this.playing = true;
    this.current = src;
    this.onState({ playing: true, queued: this.queue.length });
    var self = this;
    src.onended = function () {
      self.playing = false;
      self.current = null;
      self._pump();
    };
    src.start(0);
  };

  PcmPlayQueue.prototype.flush = function () {
    this.queue = [];
    try {
      if (this.current) {
        this.current.onended = null;
        this.current.stop(0);
      }
    } catch (e) {}
    this.current = null;
    this.playing = false;
    this.onState({ playing: false, queued: 0, flushed: true });
  };

  PcmPlayQueue.prototype.stop = function () {
    this.flush();
    try { if (this.ctx) this.ctx.close(); } catch (e) {}
    this.ctx = null;
  };

  function DawnNeuralTts() {
    this.wavStatus = 'UNKNOWN'; // MISSING | PRESENT_ASSET | PRESENT_IDB
    this.wavUrl = resolveAssetUrl(ASSET_TARGET_WAV);
    this.legacyUrl = resolveAssetUrl(ASSET_LEGACY_WAV);
    this.targetStatus = 'UNKNOWN'; // realtime-target-v1
    this.legacyStatus = 'UNKNOWN'; // natural-female-v2
    this.wavObjectUrl = null;
    this.wavMeta = null;
    this.engineStatus = 'UNKNOWN';
    this.queue = new PcmPlayQueue({});
    this.lastError = '';
  }

  DawnNeuralTts.prototype._headOk = async function (url) {
    try {
      assertNoForbidden(url);
      var r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return !!r.ok;
    } catch (e) {
      return false;
    }
  };

  DawnNeuralTts.prototype.probe = async function () {
    // 1) NEW realtime target asset (primary)
    this.targetStatus = (await this._headOk(this.wavUrl)) ? 'PRESENT_ASSET' : 'MISSING';
    // 2) Earlier v2 reference (kept)
    this.legacyStatus = (await this._headOk(this.legacyUrl)) ? 'PRESENT_ASSET' : 'MISSING';

    if (this.targetStatus === 'PRESENT_ASSET') {
      this.wavStatus = 'PRESENT_ASSET';
      this.wavMeta = {
        source: 'asset',
        role: 'realtime_target_v1',
        url: this.wavUrl,
        path: 'app/assets/dawn-voice/dawn-realtime-target-v1.wav'
      };
    } else {
      // IndexedDB drop-in (browser-local until committed)
      var rec = await idbGet();
      if (rec && rec.blob) {
        if (this.wavObjectUrl) {
          try { URL.revokeObjectURL(this.wavObjectUrl); } catch (e2) {}
        }
        this.wavObjectUrl = URL.createObjectURL(rec.blob);
        this.wavStatus = 'PRESENT_IDB';
        this.wavMeta = {
          source: 'indexeddb',
          name: rec.name || IDB_KEY,
          size: rec.size || (rec.blob && rec.blob.size) || 0,
          sha256: rec.sha256 || null,
          savedAt: rec.savedAt || null
        };
      } else if (this.legacyStatus === 'PRESENT_ASSET') {
        // Fallback preview anchor only — still not product TTS
        this.wavStatus = 'PRESENT_ASSET';
        this.wavUrl = this.legacyUrl;
        this.wavMeta = {
          source: 'asset',
          role: 'legacy_v2_earlier_reference',
          url: this.legacyUrl,
          path: 'app/assets/dawn-voice/dawn-natural-female-v2.wav'
        };
      } else {
        this.wavStatus = 'MISSING';
        this.wavMeta = null;
      }
    }

    // Neural engine: no GPU on this box → blocked for Qwen3-TTS / CosyVoice
    this.engineStatus = this._classifyEngine();
    return this.status();
  };

  DawnNeuralTts.prototype._classifyEngine = function () {
    // Optional future local endpoint (free/self-host only). Not deployed yet.
    // If someone later hosts CPU/GPU TTS at same-origin /functions/v1/dawn-own-tts,
    // probe would flip — for now honest BLOCKED.
    if (this.wavStatus === 'MISSING') return 'MUTED_WAITING_WAV';
    return 'BLOCKED_NEED_GPU';
  };

  DawnNeuralTts.prototype.status = function () {
    return {
      wavStatus: this.wavStatus,
      wavMeta: this.wavMeta,
      targetStatus: this.targetStatus,
      legacyStatus: this.legacyStatus,
      engineStatus: this.engineStatus,
      productPlayback: false,
      reason:
        this.engineStatus === 'MUTED_WAITING_WAV'
          ? 'MISSING_realtime_target_and_legacy_refs'
          : this.engineStatus === 'BLOCKED_NEED_GPU'
            ? 'Qwen3-TTS/CosyVoice need GPU; box has none; torch not installed'
            : this.engineStatus,
      approvedPath: 'dawn-realtime-target-v1.wav (NEW) + free neural TTS (Qwen3-TTS / CosyVoice); v2 kept as earlier reference',
      rejected: ['speechSynthesis', 'Web Speech TTS', 'Gemini Live TTS'],
      nextStep:
        this.targetStatus !== 'PRESENT_ASSET' && this.wavStatus === 'MISSING'
          ? 'Commit dawn-realtime-target-v1.wav or drop wav into test page; then provision free GPU for neural clone'
          : 'Provision free GPU or CPU host for Qwen3-TTS/CosyVoice; wire dawn-own-tts; never mark AVAILABLE until hear-test pass'
    };
  };

  /**
   * Accept user-dropped wav (or GPT-provided file). Does NOT auto-commit to git.
   */
  DawnNeuralTts.prototype.acceptWavFile = async function (file) {
    if (!file) throw new Error('NO_FILE');
    var name = String(file.name || '');
    if (!/\.wav$/i.test(name) && file.type !== 'audio/wav' && file.type !== 'audio/x-wav') {
      throw new Error('NEED_WAV_FILE');
    }
    var buf = await file.arrayBuffer();
    // RIFF/WAVE magic
    var u8 = new Uint8Array(buf);
    var isRiff = u8.length >= 12 &&
      u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x41 && u8[10] === 0x56 && u8[11] === 0x45;
    if (!isRiff) throw new Error('NOT_RIFF_WAV');
    var sha = await sha256Hex(buf);
    var blob = new Blob([buf], { type: 'audio/wav' });
    var rec = {
      name: name || 'dawn-natural-female-v2.wav',
      size: blob.size,
      sha256: sha,
      savedAt: new Date().toISOString(),
      blob: blob
    };
    await idbPut(rec);
    await this.probe();
    return this.status();
  };

  DawnNeuralTts.prototype.clearDroppedWav = async function () {
    await idbClear();
    if (this.wavObjectUrl) {
      try { URL.revokeObjectURL(this.wavObjectUrl); } catch (e) {}
      this.wavObjectUrl = null;
    }
    return this.probe();
  };

  DawnNeuralTts.prototype._playUrl = function (url) {
    if (!url) {
      this.lastError = 'WAV_MISSING';
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      var a = new Audio(url);
      a.onended = function () { resolve(true); };
      a.onerror = function () { resolve(false); };
      a.play().catch(function () { resolve(false); });
    });
  };

  DawnNeuralTts.prototype.previewReference = async function () {
    await this.probe();
    var url = null;
    if (this.wavStatus === 'PRESENT_ASSET') url = this.wavUrl;
    else if (this.wavStatus === 'PRESENT_IDB') url = this.wavObjectUrl;
    return this._playUrl(url);
  };

  /** Preview NEW realtime speaking TARGET (video-derived). */
  DawnNeuralTts.prototype.previewRealtimeTarget = async function () {
    await this.probe();
    if (this.targetStatus !== 'PRESENT_ASSET') {
      this.lastError = 'TARGET_MISSING';
      return false;
    }
    return this._playUrl(resolveAssetUrl(ASSET_TARGET_WAV));
  };

  /** Preview earlier v2 short reference (kept). */
  DawnNeuralTts.prototype.previewLegacyV2 = async function () {
    await this.probe();
    if (this.legacyStatus !== 'PRESENT_ASSET') {
      this.lastError = 'LEGACY_MISSING';
      return false;
    }
    return this._playUrl(resolveAssetUrl(ASSET_LEGACY_WAV));
  };

  /**
   * Product speak: only plays if neural engine READY.
   * Otherwise returns muted result — NEVER falls back to speechSynthesis.
   */
  DawnNeuralTts.prototype.speak = async function (text, opts) {
    opts = opts || {};
    await this.probe();
    var st = this.status();
    if (st.engineStatus !== 'READY') {
      return {
        played: false,
        muted: true,
        status: st,
        text: String(text || '')
      };
    }
    // Future: stream chunks from free neural endpoint into this.queue
    // Placeholder kept honest — never auto-call unpaid stubs as success.
    return {
      played: false,
      muted: true,
      status: Object.assign({}, st, { engineStatus: 'BLOCKED_NOT_WIRED' }),
      text: String(text || '')
    };
  };

  DawnNeuralTts.prototype.bargeInFlush = function () {
    this.queue.flush();
  };

  DawnNeuralTts.prototype.stop = function () {
    this.queue.stop();
  };

  root.DawnNeuralTts = DawnNeuralTts;
  root.DawnNeuralTtsMeta = {
    idbKey: IDB_KEY,
    assetPath: 'app/assets/dawn-voice/dawn-realtime-target-v1.wav',
    legacyAssetPath: 'app/assets/dawn-voice/dawn-natural-female-v2.wav',
    realtimeTargetRole: 'NEW speaking voice TARGET from user video audio',
    gpuRequiredFor: ['Qwen3-TTS', 'CosyVoice'],
    boxGpu: false,
    productUsesBrowserSynth: false,
    productAvailable: false
  };
})(typeof window !== 'undefined' ? window : globalThis);
