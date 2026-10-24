/**
 * Dawn free short-video: Canvas animation + MediaRecorder.
 * Output is usually video/webm (Chrome/Android). iPhone Safari may lack WebM;
 * status must stay honest. NOT Magic Hour / image→video API.
 */
(function (root) {
  "use strict";
  const STATUS = {
    engine: "Canvas + MediaRecorder",
    paid_image_to_video: "DISABLED_BY_POLICY",
    magic_hour: "GATES_CLOSED"
  };

  function supportedMime() {
    const MR = root.MediaRecorder;
    if (!MR) return null;
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4"
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (MR.isTypeSupported && MR.isTypeSupported(candidates[i])) return candidates[i];
    }
    return "";
  }

  async function recordPosterClip(opts) {
    const secs = Math.min(8, Math.max(2, (opts && opts.seconds) || 5));
    const w = (opts && opts.width) || 640;
    const h = (opts && opts.height) || 360;
    const mime = supportedMime();
    if (mime === null) throw new Error("BLOCKED_NO_MEDIA_RECORDER");
    // empty string means browser has MediaRecorder but no known mime — still try default

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    if (!root.DawnFreePoster) throw new Error("missing DawnFreePoster");
    const stream = canvas.captureStream(30);
    const chunks = [];
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 })
                     : new MediaRecorder(stream);
    const stopped = new Promise((resolve, reject) => {
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = (e) => reject(e.error || new Error("recorder_error"));
      rec.onstop = () => resolve();
    });
    rec.start(200);

    const t0 = performance.now();
    let raf;
    await new Promise((resolve) => {
      const tick = () => {
        const elapsed = (performance.now() - t0) / 1000;
        const prompt = ((opts && opts.prompt) || "曙光短片") + " · t=" + elapsed.toFixed(1);
        DawnFreePoster.drawPoster(canvas, { title: (opts && opts.title) || "曙光短片", prompt });
        // moving sun accent: redraw already includes sun; add time sparkles
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(255,233,168,0.8)";
        for (let i = 0; i < 12; i++) {
          const x = (Math.sin(elapsed * 2 + i) * 0.4 + 0.5) * w;
          const y = (Math.cos(elapsed * 1.3 + i) * 0.2 + 0.25) * h;
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#ffe9a8";
        ctx.font = "bold 18px system-ui";
        ctx.fillText("FREE Canvas 短片 · 非 AI 圖生影片", 16, h - 16);
        if (elapsed >= secs) resolve();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    cancelAnimationFrame(raf);
    rec.stop();
    await stopped;
    stream.getTracks().forEach(t => t.stop());
    const type = rec.mimeType || mime || "video/webm";
    const blob = new Blob(chunks, { type });
    if (!blob.size) throw new Error("empty_recording");
    return {
      ok: true,
      blob,
      mime: blob.type,
      bytes: blob.size,
      seconds: secs,
      status: "REAL_CANVAS_RECORDING",
      not: "NOT_AI_IMAGE_TO_VIDEO",
      engine: STATUS.engine
    };
  }

  root.DawnFreeShortVideo = { STATUS, supportedMime, recordPosterClip };
})(typeof window !== "undefined" ? window : globalThis);
