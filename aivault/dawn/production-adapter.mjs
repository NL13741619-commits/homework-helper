// Own production only. No external contractor path.
export async function produce(ctx, task) {
  if (!ctx?.ownEndpoint) {
    return { ok: false, error: 'BLOCKED_NO_OWN_MODEL', kind: task?.kind };
  }
  const body = {
    kind: task?.kind || 'text_to_video_5s',
    prompt: task?.prompt || '',
    duration_sec: task?.duration_sec || 5,
    reference_image: task?.reference_image || null
  };
  const res = await fetch(ctx.ownEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.auth ? { Authorization: ctx.auth } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.status, kind: body.kind };
  return { ok: true, kind: body.kind, owned: true, result: data };
}
