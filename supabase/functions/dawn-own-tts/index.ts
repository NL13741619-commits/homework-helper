/**
 * dawn-own-tts — Base 2 free/self-host neural TTS stub.
 * NOT deployed by default. When deployed without GPU/weights → honest 503.
 * Never calls Gemini Live / Grok / Kling / Magic Hour.
 * Never treats browser synth as success.
 */
import { paidAllowed, PAID_DENIED } from "../_shared/paid_gate.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Paid TTS providers always gated; default deny.
  if (!paidAllowed("dawn-own-tts-paid")) {
    // Even if someone later adds a paid provider, kill switch applies.
    // This stub never calls paid APIs — only reports free-path blockers.
  } else {
    // Explicit: we still refuse to implement paid path here.
    return new Response(
      JSON.stringify({ error: PAID_DENIED, detail: "Paid TTS not implemented in dawn-own-tts" }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const text = String(body.text || "").slice(0, 500);
  // Reference wav must be supplied by caller / object storage later — not in Postgres.
  const hasRefHint = Boolean(body.reference_sha256 || body.reference_url);

  const payload = {
    ok: false,
    inference_executed: false,
    product_tts: "NOT_AVAILABLE",
    error: hasRefHint ? "BLOCKED_NEED_GPU" : "MUTED_WAITING_WAV",
    reason: hasRefHint
      ? "Qwen3-TTS / CosyVoice natural clone needs GPU (or approved free CPU host). This Edge runtime has no GPU weights loaded."
      : "dawn-natural-female-v2.wav missing — provide reference before neural speak",
    next_step: hasRefHint
      ? "Host Qwen3-TTS or CosyVoice on free/self GPU node; point DAWN_OWN_TTS_UPSTREAM; hear-test; then allow AVAILABLE"
      : "Place app/assets/dawn-voice/dawn-natural-female-v2.wav or upload via test page IndexedDB then commit",
    echo_text_len: text.length,
    gemini_live: false,
    browser_speech_synthesis: false,
    paid_called: false,
  };

  return new Response(JSON.stringify(payload), {
    status: 503,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
