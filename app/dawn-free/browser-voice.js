/**
 * Dawn free browser voice — Web Speech API only.
 * NOT Gemini Live. NOT a neural TTS model owned by AIVAULT.
 *
 * Product policy (2026-10-24): browser speechSynthesis is REJECTED as the
 * Dawn product voice ("too fake / 電音"). Callers must not market this as
 * the approved Dawn voice. Approved path = dawn-natural-female-v2.wav
 * reference + free neural TTS (e.g. future Qwen3-TTS).
 *
 * Status labels:
 *   tts_product: REJECTED_BROWSER_SYNTH
 *   tts_debug: AVAILABLE_BROWSER (engineering only)
 *   asr: AVAILABLE_BROWSER | BLOCKED_NO_SPEECH_RECOGNITION
 */
(function (root) {
  "use strict";
  const STATUS = {
    tts_product: "REJECTED_BROWSER_SYNTH",
    tts: "REJECTED_AS_PRODUCT_VOICE",
    tts_debug: typeof root.speechSynthesis !== "undefined" ? "AVAILABLE_BROWSER_DEBUG_ONLY" : "BLOCKED_NO_SPEECH_SYNTHESIS",
    asr: !!(root.SpeechRecognition || root.webkitSpeechRecognition) ? "AVAILABLE_BROWSER" : "BLOCKED_NO_SPEECH_RECOGNITION",
    engine: "Web Speech API (browser / OS) — REJECTED as Dawn product voice",
    approved_path: "dawn-natural-female-v2.wav + free neural TTS (e.g. Qwen3-TTS)",
    gemini_live: "DISABLED_BY_POLICY"
  };

  function pickZhVoice() {
    const voices = root.speechSynthesis ? root.speechSynthesis.getVoices() : [];
    const prefer = voices.find(v => /zh-TW|zh_TW|Chinese.*Taiwan/i.test(v.lang + v.name));
    const anyZh = voices.find(v => /^zh/i.test(v.lang));
    return prefer || anyZh || voices[0] || null;
  }

  /** Debug-only speak. Must not be presented as product Dawn voice. */
  function speak(text, opts) {
    return new Promise((resolve, reject) => {
      if (!root.speechSynthesis) return reject(new Error("BLOCKED_NO_SPEECH_SYNTHESIS"));
      root.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = (opts && opts.lang) || "zh-TW";
      const v = pickZhVoice();
      if (v) u.voice = v;
      u.rate = (opts && opts.rate) || 1;
      u.onend = () => resolve({
        ok: true,
        engine: STATUS.engine,
        voice: v && v.name,
        product_voice: "REJECTED_BROWSER_SYNTH"
      });
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
        const text = ev.results[0][0].transcript;
        resolve({ ok: true, text, engine: STATUS.engine });
      };
      rec.onerror = (e) => reject(new Error((e && e.error) || "asr_error"));
      rec.start();
    });
  }

  root.DawnFreeVoice = { STATUS, speak, stopSpeak, listenOnce, pickZhVoice };
})(typeof window !== "undefined" ? window : globalThis);
