// Dawn watches its own video or screen recording.
export async function watch(ctx, input) {
  const src = input?.path || input?.url;
  if (!src) return { ok: false, error: 'MISSING_SOURCE' };
  if (!ctx?.visionEndpoint) {
    return { ok: false, error: 'BLOCKED_NO_VISION', source: src };
  }
  const res = await fetch(ctx.visionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.auth ? { Authorization: ctx.auth } : {})
    },
    body: JSON.stringify({
      source: src,
      task: input?.task || 'describe and list problems'
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.status, source: src };
  return { ok: true, source: src, summary: data.summary || data, issues: data.issues || [] };
}
