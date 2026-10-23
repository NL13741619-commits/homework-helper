// Own production only. First capability: image_to_video_6s.
export async function produce(ctx, task) {
  if (!ctx?.ownEndpoint) {
    return { ok: false, error: 'BLOCKED_NO_OWN_MODEL', kind: task?.kind };
  }
  const kind = task?.kind || 'image_to_video_6s';
  const body = {
    kind,
    prompt: task?.prompt || '',
    duration_sec: task?.duration_sec || 6,
    reference_image: task?.reference_image || null
  };
  if (kind === 'image_to_video_6s' && !body.reference_image) {
    return { ok: false, error: 'MISSING_IMAGE', kind };
  }
  const res = await fetch(ctx.ownEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.auth ? { Authorization: ctx.auth } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || res.status, kind };
  return { ok: true, kind, owned: true, result: data };
}
