// Call a free image-to-video endpoint, return clip URL or path.
export async function fetchClip(ctx, task) {
  if (!ctx?.endpoint) return { ok: false, error: 'NO_ENDPOINT' };
  const body = {
    kind: 'image_to_video',
    prompt: task?.prompt || '',
    duration_sec: task?.duration_sec || 6,
    image: task?.reference_image || null
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
  if (!res.ok) return { ok: false, error: data.error || res.status };
  return { ok: true, clip: data.url || data.path || data };
}
