/**
 * Dawn free melody + DSP singing prototype (Web Audio).
 * Honest label: EXPERIMENTAL_DSP_SINGING — not a trained neural singing model.
 * License of generated tones: AIVAULT-owned synthesis (no third-party song).
 */
(function (root) {
  "use strict";
  const STATUS = "EXPERIMENTAL_DSP_SINGING";

  // C major scale MIDI relative
  const SCORE = [
    { midi: 60, dur: 0.45, syl: "小" },
    { midi: 62, dur: 0.45, syl: "太" },
    { midi: 64, dur: 0.45, syl: "陽" },
    { midi: 65, dur: 0.45, syl: "啊" },
    { midi: 67, dur: 0.6, syl: "早" },
    { midi: 65, dur: 0.45, syl: "安" },
    { midi: 64, dur: 0.45, syl: "呀" },
    { midi: 62, dur: 0.8, syl: "！" }
  ];

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function sing(lyrics) {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return Promise.reject(new Error("BLOCKED_NO_AUDIO_CONTEXT"));
    const ctx = new AC();
    const syls = String(lyrics || "").replace(/\s+/g, "") || SCORE.map(s => s.syl).join("");
    let t = ctx.currentTime + 0.05;
    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);

    SCORE.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToHz(note.midi);
      // soft vowel formant-ish second partial
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.value = midiToHz(note.midi) * 2;
      g2.gain.value = 0.08;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.connect(g); g.connect(master);
      osc2.connect(g2); g2.connect(master);
      osc.start(t); osc.stop(t + note.dur + 0.02);
      osc2.start(t); osc2.stop(t + note.dur + 0.02);
      note._syl = syls[i] || note.syl;
      t += note.dur;
    });

    return {
      ok: true,
      status: STATUS,
      bpm: 100,
      notes: SCORE.map(n => ({ midi: n.midi, dur: n.dur, syl: n._syl || n.syl })),
      duration_sec: +(t - ctx.currentTime).toFixed(2),
      license: "AIVAULT original DSP tones; no third-party song",
      stop: () => { try { ctx.close(); } catch (_) {} }
    };
  }

  root.DawnFreeSing = { STATUS, SCORE, sing, midiToHz };
})(typeof window !== "undefined" ? window : globalThis);
