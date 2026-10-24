/**
 * Dawn natural reference playback (Base 2).
 * Plays dawn-natural-female-v2.wav with optional crude pitch/gain envelopes
 * for 抑揚頓挫 demo. Label: REFERENCE_PLAYBACK — NOT neural TTS/singing,
 * NOT Web Speech, NOT product AVAILABLE singing.
 */
(function (root) {
  "use strict";

  var DEFAULT_WAV = "assets/dawn-voice/dawn-natural-female-v2.wav";
  var STATUS = {
    engine: "Web Audio BufferSource + playbackRate/gain envelopes",
    label: "REFERENCE_PLAYBACK",
    product_tts: false,
    neural_singing: false,
    web_speech: "REJECTED"
  };

  function resolveUrl(path) {
    try {
      return new URL(path, root.location.href).href;
    } catch (e) {
      return path;
    }
  }

  function DawnRefPlayback(opts) {
    this.wavUrl = resolveUrl((opts && opts.wavUrl) || DEFAULT_WAV);
    this.ctx = null;
    this.buffer = null;
    this.nodes = [];
    this.status = "IDLE";
  }

  DawnRefPlayback.prototype.ensureCtx = function () {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) throw new Error("BLOCKED_NO_AUDIO_CONTEXT");
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  };

  DawnRefPlayback.prototype.load = async function () {
    this.ensureCtx();
    var res = await fetch(this.wavUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("REFERENCE_WAV_FETCH_FAILED:" + res.status);
    var ab = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(ab.slice(0));
    this.status = "LOADED";
    return {
      ok: true,
      duration: this.buffer.duration,
      sampleRate: this.buffer.sampleRate,
      channels: this.buffer.numberOfChannels,
      label: STATUS.label
    };
  };

  DawnRefPlayback.prototype.stop = function () {
    for (var i = 0; i < this.nodes.length; i++) {
      try { this.nodes[i].stop(); } catch (e) {}
      try { this.nodes[i].disconnect(); } catch (e) {}
    }
    this.nodes = [];
  };

  /**
   * mode: 'plain' | 'speak_prosody' | 'sing_steps'
   * speak_prosody: gentle rate + gain curves (抑揚頓挫 demo)
   * sing_steps: stepped playbackRate on melody ratios — still REFERENCE_PLAYBACK
   */
  DawnRefPlayback.prototype.play = async function (mode) {
    if (!this.buffer) await this.load();
    this.stop();
    var ctx = this.ensureCtx();
    var src = ctx.createBufferSource();
    src.buffer = this.buffer;
    var gain = ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain);
    gain.connect(ctx.destination);
    this.nodes.push(src);

    var t0 = ctx.currentTime + 0.02;
    var dur = this.buffer.duration;
    mode = mode || "plain";

    if (mode === "plain") {
      src.playbackRate.value = 1;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.05);
      gain.gain.setValueAtTime(0.9, t0 + Math.max(0.1, dur - 0.12));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else if (mode === "speak_prosody") {
      // Crude phrase contour: slight rise then fall; not neural.
      src.playbackRate.setValueAtTime(0.96, t0);
      src.playbackRate.linearRampToValueAtTime(1.06, t0 + dur * 0.35);
      src.playbackRate.linearRampToValueAtTime(1.02, t0 + dur * 0.55);
      src.playbackRate.linearRampToValueAtTime(0.94, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.08);
      gain.gain.linearRampToValueAtTime(1.0, t0 + dur * 0.4);
      gain.gain.linearRampToValueAtTime(0.55, t0 + dur * 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else if (mode === "sing_steps") {
      // Relative steps ~ C major feel on playbackRate (honest: warps the same take)
      var steps = [1.0, 1.122, 1.26, 1.122, 1.0, 0.89, 1.0, 1.189];
      var slice = dur / steps.length;
      for (var i = 0; i < steps.length; i++) {
        var ti = t0 + i * slice;
        if (i === 0) src.playbackRate.setValueAtTime(steps[i], ti);
        else src.playbackRate.linearRampToValueAtTime(steps[i], ti);
        var gPeak = 0.55 + (i % 2) * 0.25;
        gain.gain.setValueAtTime(0.15, ti);
        gain.gain.linearRampToValueAtTime(gPeak, ti + slice * 0.25);
        gain.gain.linearRampToValueAtTime(0.2, ti + slice * 0.95);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      throw new Error("UNKNOWN_MODE");
    }

    src.start(t0);
    src.stop(t0 + dur + 0.05);
    this.status = "PLAYING_" + mode.toUpperCase();
    return {
      ok: true,
      mode: mode,
      label: STATUS.label,
      neural_singing: false,
      product_voice: false,
      note: mode === "sing_steps"
        ? "REFERENCE_PLAYBACK warping one natural take — NOT neural singing / NOT AVAILABLE product singing"
        : "REFERENCE_PLAYBACK with crude prosody envelopes — NOT free neural TTS"
    };
  };

  root.DawnRefPlayback = DawnRefPlayback;
  root.DawnRefPlayback.STATUS = STATUS;
})(typeof window !== "undefined" ? window : globalThis);
