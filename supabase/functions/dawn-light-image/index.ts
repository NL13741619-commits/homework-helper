/**
 * Base 2 dawn-light-image — free path only.
 * Does NOT proxy Base 1 dark-star-image-generation / Gemini.
 * AI neural image generation: BLOCKED_NO_FREE_IMAGE_PROVIDER.
 * Clients should use app/dawn-jpg-studio.html for real JPEG via Canvas.
 */
import { paidAllowed, PAID_DENIED } from "../_shared/paid_gate.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://nl13741619-commits.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    return json({
      agent_id: "dawn-light",
      function: "dawn-light-image",
      jpeg_canvas_studio: "app/dawn-jpg-studio.html",
      neural_image: "BLOCKED_NO_FREE_IMAGE_PROVIDER",
      base1_proxy: "DISABLED",
      paid_gate_default: "DENY",
    });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Hard deny any paid image feature name if somehow listed
  if (paidAllowed("gemini_image") || paidAllowed("dark_star_image")) {
    return json({
      agent_id: "dawn-light",
      ok: false,
      error: PAID_DENIED,
      note: "Base 2 image must stay free; paid image features remain gated.",
      inference_executed: false,
    }, 403);
  }

  let body: { prompt?: string; mode?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return json({ agent_id: "dawn-light", error: "need_prompt", inference_executed: false }, 400);

  // Free neural providers are not wired. Honest block.
  return json({
    agent_id: "dawn-light",
    function: "dawn-light-image",
    ok: false,
    error: "BLOCKED_NO_FREE_IMAGE_PROVIDER",
    mode: body.mode || "neural",
    prompt_echo: prompt.slice(0, 200),
    free_alternative: {
      path: "app/dawn-jpg-studio.html",
      engine: "Canvas procedural poster + canvas.toBlob(image/jpeg)",
      status: "AVAILABLE_CLIENT_SIDE",
    },
    base1_dark_star_image_generation: "NOT_CALLED",
    inference_executed: false,
  }, 503);
});
