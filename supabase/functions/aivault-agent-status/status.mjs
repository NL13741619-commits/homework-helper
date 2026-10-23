export function summarizeRuntime(row, now = Date.now()) {
  const last = Date.parse(row?.last_tick_at);
  const age = Number.isFinite(last) ? Math.floor((now - last) / 1000) : null;
  return {
    instance_id: row?.instance_id || 'base-002:dawn-light',
    state: !row ? 'UNKNOWN' : !row.enabled ? 'DISABLED' : age === null ? 'UNKNOWN' : age < -30 ? 'CLOCK_SKEW' : age > 900 ? 'STALE' : 'BACKEND_ALIVE',
    last_tick_at: row?.last_tick_at || null,
    age_seconds: age,
    stale_after_seconds: 900,
    model_approved: row?.model_policy?.approved === true,
    meaning: 'Backend scheduler heartbeat; does not prove any AI model is running.'
  };
}
export function createStatus({env, fetchImpl = fetch, now = Date.now}) {
  return async () => {
    const base = env('SUPABASE_URL');
    const service = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!base || !service) return Response.json({error:'STATUS_UNAVAILABLE'}, {status:503});
    try {
      const response = await fetchImpl(base + '/rest/v1/ai_agent_runtime_config?select=instance_id,enabled,last_tick_at,model_policy&instance_id=eq.base-002%3Adawn-light', {
        headers: {apikey:service, Authorization:'Bearer '+service},
        redirect:'error', signal:AbortSignal.timeout(8000)
      });
      if (!response.ok) throw Error('DATABASE_UNAVAILABLE');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('INVALID_STATUS');
      let gateway = 'UNKNOWN';
      try {
        const probe = await fetchImpl(base + '/functions/v1/ai-gateway', {
          method:'HEAD', headers:{apikey:env('SUPABASE_ANON_KEY') || ''},
          redirect:'error', signal:AbortSignal.timeout(5000)
        });
        gateway = probe.status === 404 ? 'NOT_DEPLOYED' : 'MODEL_NOT_VERIFIED';
      } catch (_) {}
      return Response.json({ok:true,checked_at:new Date(now()).toISOString(),runtime:summarizeRuntime(rows[0],now()),gateway,model_inference_executed:false}, {headers:{'Cache-Control':'no-store'}});
    } catch (_) {
      return Response.json({error:'STATUS_UNAVAILABLE',model_inference_executed:false}, {status:503});
    }
  };
}
