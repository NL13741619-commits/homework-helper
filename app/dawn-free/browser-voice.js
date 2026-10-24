/**
 * Browser Web Speech helpers — REJECTED as Dawn product voice (2026-10-24).
 * Prefer muted UI; only call speak() behind explicit "已駁回" disclosure.
 * Status must never be marketed as AVAILABLE product TTS.
 */
(function (root) {
  "use strict";
  const STATUS = {
    tts: typeof root.speechSynthesis !== "undefined" ? "REJECTED_BROWSER_SYNTH_NOT_PRODUCT" : "BLOCKED_NO_SPEECH_SYNTHESIS",
    asr: !!(root.SpeechRecognition || root.webkitSpeechRecognition) ? "AVAILABLE_BROWSER_ASR_INPUT_ONLY" : "BLOCKED_NO_SPEECH_RECOGNITION",
    engine: "Web Speech API (browser / OS) — REJECTED as Dawn product voice",
    product_playback_default: "MUTED",
    natural_wav: "dawn-natural-female-v2.wav",
    natural_status: "PENDING_NATURAL_CLONE",
    gemini_live: "DISABLED_BY_POLICY"
  };

  function pickZhVoice() {
    const voices = root.speechSynthesis ? root.speechSynthesis.getVoices() : [];
    const prefer = voices.find(v => /zh-TW|zh_TW|Chinese.*Taiwan/i.test(v.lang + v.name));
    const anyZh = voices.find(v => /^zh/i.test(v.lang));
    return prefer || anyZh || voices[0] || null;
  }

  function speak(text, opts) {
    return new Promise((resolve, reject) => {
      if (!root.speechSynthesis) return reject(new Error("BLOCKED_NO_SPEECH_SYNTHESIS"));
      root.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = (opts && opts.lang) || "zh-TW";
      const v = pickZhVoice();
      if (v) u.voice = v;
      u.rate = (opts && opts.rate) || 1;
      u.onend = () => resolve({ ok: true, engine: STATUS.engine, voice: v && v.name, product: false, rejected: true });
      u.onerror = (e) => reject(new Error((e && e.error) || "tts_error"));
      root.speechSynthesis.speak(u);
    });
  }

  function stopSpeak() {
    try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (_) {}
  }

  function listenOnce(opts) {
    return new Promise((resolve, reject) => {
      const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
      if (!SR) return reject(new Error("BLOCKED_NO_SPEECH_RECOGNITION"));
      const rec = new SR();
      rec.lang = (opts && opts.lang) || "zh-TW";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        resolve({ ok: true, text: ev.results[0][0].transcript, engine: "Web Speech ASR" });
      };
      rec.onerror = (e) => reject(new Error((e && e.error) || "asr_error"));
      rec.start();
    });
  }

  root.DawnFreeVoice = { STATUS, speak, stopSpeak, listenOnce, pickZhVoice };
})(typeof window !== "undefined" ? window : globalThis);
