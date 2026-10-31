// Base2 AI discussion engine (pure logic; Edge Function wraps it). AIs read a post + approved thread, then
// propose a comment or a threaded reply. Everything lands as PENDING until the founder approves.
// Order of checks: kill switch → post enabled/cap → revoked → rate limits → Base1 quota guard (pool_discussion ≤50%)
// → generate via existing AI Gateway (adapter) → guards (AI-disclosure, impersonation, similarity, sha dedupe) → governance → insert pending.
const enc = new TextEncoder();
export async function sha256(s) { const h = await crypto.subtle.digest("SHA-256", enc.encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function grams(s) { const t = String(s).toLowerCase().replace(/\s+/g, ""); const g = new Set(); for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3)); return g; }
export function similarity(a, b) { const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
const IMPERSONATE = /(我是真人|我是人類|身為人類|\bi am (a )?(real )?(human|person)\b)/i;
const SPAM = /(https?:\/\/\S+){3,}|限時優惠|免費領取|點擊這裡|buy now/i;

export class DiscussionEngine {
  constructor({ db, gateway, quota, governance, now = () => Date.now(), provider = "gemini" }) { Object.assign(this, { db, gateway, quota, governance, now, provider }); }
  async propose({ postId, agent, parentId = null }) {
    const c = await this.db.control();
    const deny = async (reason, extra = {}) => { await this.db.audit({ actor: agent.id, action: "AI_COMMENT_DENIED", target: postId, detail: { reason, ...extra } }); return { ok: false, reason }; };
    if (!c.enabled) return deny("KILL_SWITCH_OFF");
    const post = await this.db.post(postId);
    if (!post || post.status !== "published" || !post.ai_discussion_enabled) return deny("POST_NOT_OPEN");
    if (c.revoked_agents.includes(agent.id)) return deny("AGENT_REVOKED");
    const thread = await this.db.comments(postId);                      // all statuses (for dedupe/caps)
    if (thread.length >= post.ai_comment_cap) return deny("POST_CAP_REACHED");
    if (thread.filter(x => x.ai_agent_id === agent.id).length >= c.per_agent_per_post) return deny("AGENT_POST_CAP");
    let parent = null, depth = 0;
    if (parentId) { parent = thread.find(x => x.id === parentId && x.moderation === "approved"); if (!parent) return deny("INVALID_PARENT"); if (parent.ai_agent_id === agent.id) return deny("NO_SELF_REPLY"); depth = parent.depth + 1; if (depth > 3) return deny("THREAD_TOO_DEEP"); }
    else if (thread.some(x => x.ai_agent_id === agent.id && !x.parent_id)) return deny("ONE_TOP_LEVEL_PER_AGENT");
    const t = this.now(), rate = await this.db.counts({ sinceMinute: t - 60000, sinceDay: t - 86400000, agentId: agent.id });
    if (rate.minute >= c.global_per_minute) return deny("GLOBAL_PER_MINUTE");
    if (rate.day >= c.global_per_day) return deny("GLOBAL_PER_DAY");
    if (rate.agentDay >= c.per_agent_per_day) return deny("AGENT_PER_DAY");
    const q = await this.quota.reserve({ provider: this.provider, consumer: "pool_discussion", ref: `dawn:${postId}:${agent.id}` });
    if (!q.allowed) return deny("QUOTA:" + q.reason);
    const approved = thread.filter(x => x.moderation === "approved");
    let text = String(await this.gateway.generate({ agent: agent.id, messages: [
      { role: "system", content: `你是 ${agent.name}（${agent.id}），AIVAULT 的 AI，不是人類，絕不可聲稱自己是人。只根據文章與討論內容發言，不捏造個人經歷或來源。用繁體中文，80–300 字，提出具體觀點或問題，避免客套與重複他人。角色：${agent.role || "協作池成員"}。` },
      { role: "user", content: `開創者文章《${post.title}》：\n${post.body.slice(0, 6000)}\n\n已核准討論：\n${approved.slice(-15).map(x => `[${x.ai_display_name}] ${x.body}`).join("\n") || "（尚無）"}\n\n${parent ? `請回覆 ${parent.ai_display_name}：「${parent.body}」` : "請發表你的第一則看法。"}` }] }) || "").trim();
    if (!text) return deny("EMPTY_GENERATION");
    if (IMPERSONATE.test(text)) return deny("GUARD_IMPERSONATION");
    if (SPAM.test(text)) return deny("GUARD_SPAM");
    const maxSim = Math.max(0, ...thread.map(x => similarity(x.body, text)));
    if (maxSim > c.max_similarity) return deny("GUARD_SIMILAR", { maxSim: +maxSim.toFixed(2) });
    if (text.length > 1000) text = text.slice(0, 1000);
    const hash = await sha256(text);
    if (thread.some(x => x.content_sha256 === hash)) return deny("GUARD_DUPLICATE");
    const g = await this.governance.check({ agentId: agent.id, action: parentId ? "REPLY_COMMENT" : "PUBLISH_COMMENT", target: `base2:post:${postId}`, content: text });
    if (!g.allow) return deny("GOVERNANCE:" + g.reason);
    const row = await this.db.insertComment({ post_id: postId, parent_id: parent?.id || null, ai_agent_id: agent.id, ai_display_name: agent.name, body: text, content_sha256: hash, depth, moderation: "pending", governance: g, quota_ref: q.reason });
    await this.db.audit({ actor: agent.id, action: "AI_COMMENT_PENDING", target: row.id });
    return { ok: true, comment: row, similarity: maxSim };
  }
}
// Founder moderation (Edge must verify Base1 uid ∈ FOUNDER_UIDS secret first).
export async function moderate(db, { founderUid, commentId, decision }) {
  if (!["approved", "hidden"].includes(decision)) throw new Error("INVALID_DECISION");
  const r = await db.setModeration(commentId, decision, founderUid); await db.audit({ actor: founderUid, action: "MODERATE_" + decision.toUpperCase(), target: commentId }); return r;
}
export async function killSwitch(db, { founderUid, enabled }) { await db.setControl({ enabled: !!enabled, updated_by: founderUid }); await db.audit({ actor: founderUid, action: enabled ? "DISCUSSION_ENABLED" : "DISCUSSION_STOPPED" }); }
