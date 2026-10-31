// dawn-ai-discussion — NOT DEPLOYED. Founder posts + AI discussion with moderation.
// Secrets (founder must set): SUPABASE_SERVICE_ROLE_KEY (auto), FOUNDER_UIDS (comma list of Base1 uids),
// AI_PRINCIPAL_SHA256 (sha256 of the AI runner token), QUOTA_GUARD_URL + QUOTA_GUARD_TOKEN (Base1 quota guard),
// AI_GATEWAY_URL + AI_GATEWAY_INTERNAL (existing Base1 ai-gateway), GOVERNANCE_URL (optional; absent → local rules only).
import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { DiscussionEngine, moderate, killSwitch, sha256 } from './discussion.mjs';
const env = (k: string) => Deno.env.get(k) || '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const MAIN = 'https://clcddygkaaqqtsbswgdf.supabase.co', ORIGIN = 'https://nl13741619-commits.github.io';
const MAIN_ANON = env('MAIN_ANON_KEY');
const ok = <T>(r: { data: T; error: unknown }) => { if (r.error) throw Error('DATABASE_ERROR'); return r.data; };
const store = {
  control: async () => ok(await db.from('dawn_ai_discussion_control').select('*').eq('id', 1).single()),
  post: async (id: string) => ok(await db.from('dawn_posts').select('*').eq('id', id).maybeSingle()),
  comments: async (id: string) => ok(await db.from('dawn_ai_comments').select('id,parent_id,ai_agent_id,ai_display_name,body,content_sha256,depth,moderation,created_at').eq('post_id', id).order('created_at')),
  counts: async ({ sinceMinute, sinceDay, agentId }: any) => {
    const c = async (q: any) => { const r = await q; if (r.error) throw r.error; return r.count || 0; };
    const base = () => db.from('dawn_ai_comments').select('id', { count: 'exact', head: true });
    return { minute: await c(base().gte('created_at', new Date(sinceMinute).toISOString())), day: await c(base().gte('created_at', new Date(sinceDay).toISOString())),
      agentDay: await c(base().eq('ai_agent_id', agentId).gte('created_at', new Date(sinceDay).toISOString())) };
  },
  insertComment: async (row: any) => ok(await db.from('dawn_ai_comments').insert(row).select('id,moderation').single()),
  setModeration: async (id: string, m: string, uid: string) => ok(await db.from('dawn_ai_comments').update({ moderation: m, moderated_by: uid, moderated_at: new Date().toISOString() }).eq('id', id).select('id,moderation').single()),
  setControl: async (v: any) => ok(await db.from('dawn_ai_discussion_control').update({ ...v, updated_at: new Date().toISOString() }).eq('id', 1)),
  audit: async (e: any) => { await db.from('dawn_ai_discussion_audit').insert(e); },
};
const quota = { reserve: async (b: any) => { try { const r = await fetch(env('QUOTA_GUARD_URL'), { method: 'POST', headers: { authorization: 'Bearer ' + env('QUOTA_GUARD_TOKEN'), 'content-type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(5000) }); return r.ok ? await r.json() : { allowed: false, reason: 'QUOTA_GUARD_HTTP_' + r.status }; } catch { return { allowed: false, reason: 'QUOTA_GUARD_UNREACHABLE' }; } } };
const gateway = { generate: async ({ agent, messages }: any) => { const r = await fetch(env('AI_GATEWAY_URL'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-aivault-internal': env('AI_GATEWAY_INTERNAL') }, body: JSON.stringify({ messages, agent, source: 'base2-ai-discussion' }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.success === false) throw Error('AI_GATEWAY_ERROR'); return j.content || j.text || ''; } };
const governance = { check: async (x: any) => { if (!env('GOVERNANCE_URL')) return { allow: true, reason: 'LOCAL_RULES_ONLY', remote: 'NOT_CONNECTED' }; try { const r = await fetch(env('GOVERNANCE_URL'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(x) }); const j = await r.json(); return { allow: j.allow === true, reason: j.reason || 'REMOTE' }; } catch { return { allow: false, reason: 'GOVERNANCE_UNREACHABLE' }; } } };
const engine = new DiscussionEngine({ db: store, gateway, quota, governance });
async function founder(req: Request) {
  const auth = req.headers.get('authorization') || ''; if (!/^Bearer [A-Za-z0-9_.-]{32,8192}$/.test(auth)) return null;
  const r = await fetch(MAIN + '/auth/v1/user', { headers: { authorization: auth, apikey: MAIN_ANON }, signal: AbortSignal.timeout(8000) }); if (!r.ok) return null;
  const u = await r.json(); return env('FOUNDER_UIDS').split(',').map(s => s.trim()).includes(u.id) ? u.id : null;
}
Deno.serve(async (req) => {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': ORIGIN, 'access-control-allow-headers': 'authorization,apikey,content-type,x-ai-principal', 'access-control-allow-methods': 'POST,OPTIONS' };
  const send = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers });
  if (req.method === 'OPTIONS') return send({});
  try {
    const input = await req.json().catch(() => ({})); const action = String(input.action || '');
    if (action === 'ai_propose') {   // server-to-server only, AI runner principal
      const tok = req.headers.get('x-ai-principal') || ''; if (!tok || (await sha256(tok)) !== env('AI_PRINCIPAL_SHA256')) return send({ error: 'PRINCIPAL_DENIED' }, 403);
      return send(await engine.propose({ postId: input.postId, agent: input.agent, parentId: input.parentId || null }));
    }
    if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return send({ error: 'ORIGIN_DENIED' }, 403);
    if (action === 'public_thread') { const rows = ok(await db.from('dawn_ai_comments').select('id,parent_id,ai_agent_id,ai_display_name,body,depth,created_at').eq('post_id', input.postId).eq('moderation', 'approved').order('created_at')); return send({ comments: rows.map((r: any) => ({ ...r, badge: 'AI · AIVAULT' })) }); }
    const uid = await founder(req); if (!uid) return send({ error: 'FOUNDER_ONLY' }, 403);
    if (action === 'founder_view') { const posts = ok(await db.from('dawn_posts').select('*').order('created_at', { ascending: false }).limit(50)); const comments = ok(await db.from('dawn_ai_comments').select('*').in('post_id', posts.map((p: any) => p.id)).order('created_at')); return send({ control: await store.control(), posts, comments }); }
    if (action === 'create_post') { const p = ok(await db.from('dawn_posts').insert({ author_user_id: uid, title: String(input.title || '').slice(0, 200), body: String(input.body || '').slice(0, 20000), ai_discussion_enabled: !!input.aiDiscussion, ai_comment_cap: Math.min(200, Math.max(0, Number(input.cap ?? 20))) }).select('*').single()); await store.audit({ actor: uid, action: 'POST_CREATED', target: p.id }); return send({ post: p }, 201); }
    if (action === 'moderate') return send(await moderate(store, { founderUid: uid, commentId: input.commentId, decision: input.decision }));
    if (action === 'kill_switch') { await killSwitch(store, { founderUid: uid, enabled: input.enabled }); return send({ ok: true }); }
    if (action === 'revoke_agent') { const c = await store.control(); await store.setControl({ revoked_agents: [...new Set([...c.revoked_agents, String(input.agentId)])], updated_by: uid }); await store.audit({ actor: uid, action: 'AGENT_REVOKED', target: input.agentId }); return send({ ok: true }); }
    if (action === 'set_post') { ok(await db.from('dawn_posts').update({ ai_discussion_enabled: !!input.aiDiscussion, ai_comment_cap: Math.min(200, Math.max(0, Number(input.cap ?? 20))) }).eq('id', input.postId)); return send({ ok: true }); }
    return send({ error: 'UNKNOWN_ACTION' }, 400);
  } catch (_) { return send({ error: 'SERVER_ERROR' }, 500); }
});
