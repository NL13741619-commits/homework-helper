// Minimal adapter. Dawn resolves endpoint at runtime. No hardcoded provider.
export async function invokeVideoModel(ctx, task) {
  const { kind, prompt, duration_sec = 5, reference_image } = task || {};
  if (!ctx?.endpoint) {
    return { ok: false, error: 'BLOCKED_NO_MODEL', kind };
  }
  const body = {
    kind: kind || 'text_to_video_5s',
    prompt,
    duration_sec,
    reference_image: reference_image || null
  };
  const res = await fetch(ctx.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.auth ? { Authorization: ctx.auth } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.status, kind };
  return { ok: true, kind, result: data };
}
