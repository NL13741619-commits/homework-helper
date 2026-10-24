/**
 * Dawn free JPEG export (Issue #5 Phase 1).
 * Browser-only; no paid image API. Transparent pixels become white.
 */
(function (root) {
  "use strict";
  async function exportJpeg(sourceCanvas, quality) {
    const q = typeof quality === "number" ? quality : 0.92;
    const canvas = document.createElement("canvas");
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    if (!canvas.width || !canvas.height) throw new Error("圖片尺寸無效");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG 編碼失敗"))), "image/jpeg", q);
      } catch (error) {
        reject(error);
      }
    });
    if (blob.type !== "image/jpeg") throw new Error("瀏覽器沒有輸出 JPEG");
    return blob;
  }

  function revokeLater(url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }

  root.DawnFreeJpeg = { exportJpeg, revokeLater };
})(typeof window !== "undefined" ? window : globalThis);
