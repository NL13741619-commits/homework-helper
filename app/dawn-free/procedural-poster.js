/**
 * AIVAULT-owned free "image" path: procedural dawn poster on Canvas.
 * Not a neural image model. Status: REAL_CANVAS / NOT_AI_IMAGE_MODEL.
 */
(function (root) {
  "use strict";
  function parseTheme(prompt) {
    const t = String(prompt || "").toLowerCase();
    if (/夜|night|星|moon/.test(t)) return "night";
    if (/雨|rain/.test(t)) return "rain";
    if (/城|city|建築/.test(t)) return "city";
    return "dawn";
  }

  function drawPoster(canvas, opts) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    const theme = parseTheme(opts && opts.prompt);
    const title = String((opts && opts.title) || "曙光城").slice(0, 40);
    const subtitle = String((opts && opts.prompt) || "小太陽的一天").slice(0, 120);

    let g;
    if (theme === "night") {
      g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#050810");
      g.addColorStop(1, "#1a2744");
    } else if (theme === "rain") {
      g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#2a3548");
      g.addColorStop(1, "#0c111b");
    } else if (theme === "city") {
      g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1a2744");
      g.addColorStop(1, "#3d5a73");
    } else {
      g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#ffe9a8");
      g.addColorStop(0.45, "#ffb347");
      g.addColorStop(1, "#1a2744");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft sun / moon
    const cx = w * 0.72;
    const cy = h * 0.28;
    const r = Math.min(w, h) * 0.14;
    const sun = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    if (theme === "night") {
      sun.addColorStop(0, "#f8fafc");
      sun.addColorStop(1, "rgba(248,250,252,0)");
    } else {
      sun.addColorStop(0, "#fff8df");
      sun.addColorStop(0.5, "#f3c15a");
      sun.addColorStop(1, "rgba(255,179,71,0)");
    }
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Simple buildings silhouette
    ctx.fillStyle = theme === "dawn" ? "rgba(26,39,68,0.55)" : "rgba(10,16,32,0.75)";
    const baseY = h * 0.78;
    for (let i = 0; i < 8; i++) {
      const bw = w * (0.06 + (i % 3) * 0.02);
      const bh = h * (0.12 + ((i * 37) % 5) * 0.05);
      const bx = w * 0.05 + i * w * 0.11;
      ctx.fillRect(bx, baseY - bh, bw, bh);
    }

    // Face on sun (小太陽)
    ctx.fillStyle = theme === "night" ? "#1a1020" : "#3a2a1a";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.28, cy - r * 0.05, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.28, cy - r * 0.05, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme === "night" ? "#1a1020" : "#c58b4a";
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Title card
    ctx.fillStyle = "rgba(12,17,27,0.55)";
    roundRect(ctx, w * 0.06, h * 0.62, w * 0.55, h * 0.22, 16);
    ctx.fill();
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "700 " + Math.floor(w * 0.045) + "px system-ui, 'Noto Sans TC', sans-serif";
    ctx.fillText(title, w * 0.09, h * 0.7);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "400 " + Math.floor(w * 0.028) + "px system-ui, 'Noto Sans TC', sans-serif";
    wrapText(ctx, subtitle, w * 0.09, h * 0.76, w * 0.48, Math.floor(w * 0.034));

    ctx.fillStyle = "rgba(232,238,244,0.7)";
    ctx.font = "12px system-ui";
    ctx.fillText("AIVAULT 曙光 · 免費 Canvas 海報（非 AI 生圖模型）", w * 0.06, h * 0.96);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = String(text).split("");
    let line = "";
    let yy = y;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = chars[i];
        yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  root.DawnFreePoster = { drawPoster, parseTheme, status: "REAL_CANVAS_NOT_AI_MODEL" };
})(typeof window !== "undefined" ? window : globalThis);
