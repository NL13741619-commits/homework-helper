// LOCAL tests (MOCK gateway/quota/governance; in-memory DB). SQL schema test runs only if @electric-sql/pglite is available.
import test from "node:test"; import assert from "node:assert/strict";
import { DiscussionEngine, moderate, killSwitch } from "../aivault/dawn/discussion.mjs";
function memDb(control = {}) {
  const s = { control: { enabled: true, global_per_minute: 50, global_per_day: 300, per_agent_per_day: 3, per_agent_per_post: 2, max_similarity: 0.6, revoked_agents: [], ...control },
    posts: { p1: { id: "p1", title: "AI 與教育", body: "開創者：AI 應如何協助學生學習而不取代思考？", status: "published", ai_discussion_enabled: true, ai_comment_cap: 5 } }, comments: [], audit: [] };
  let n = 0;
  return { s, control: async () => s.control, post: async id => s.posts[id], comments: async id => s.comments.filter(c => c.post_id === id),
    counts: async ({ agentId }) => ({ minute: s.comments.length, day: s.comments.length, agentDay: s.comments.filter(c => c.ai_agent_id === agentId).length }),
    insertComment: async r => { const row = { id: "c" + ++n, created_at: new Date().toISOString(), ...r }; s.comments.push(row); return row; },
    setModeration: async (id, m, uid) => { const c = s.comments.find(x => x.id === id); c.moderation = m; c.moderated_by = uid; return c; },
    setControl: async v => Object.assign(s.control, v), audit: async e => s.audit.push(e) };
}
const replies = ["我認為 AI 可以先提出引導問題，讓學生自己推理，而不是直接給答案。", "我想補充：教師可以設定 AI 只在學生卡住時提示，並記錄提示次數以便回饋。",
  "我認為 AI 可以先提出引導問題，讓學生自己推理，而不是直接給答案。", "我是真人老師，我覺得很好。", "評量時應區分學生原創與 AI 協助的部分，這需要透明的使用紀錄。"];
const mk = (db, { quotaOk = true, gov = true } = {}) => { let i = 0; return new DiscussionEngine({ db, gateway: { generate: async () => replies[i++] },
  quota: { reserve: async () => quotaOk ? { allowed: true, reason: "WITHIN_POOL_HALF" } : { allowed: false, reason: "POOL_HALF_EXHAUSTED" } }, governance: { check: async () => ({ allow: gov, reason: gov ? "OK" : "DENY" }) } }); };
const A = { id: "ag-0001", name: "協作池甲" }, B = { id: "ag-0002", name: "協作池乙" }, C = { id: "ag-0003", name: "協作池丙" }, D = { id: "ag-0004", name: "協作池丁" }, E = { id: "ag-0005", name: "協作池戊" };
test("threaded AI-to-AI discussion; pending until founder approves; guards", async () => {
  const db = memDb(), eng = mk(db);
  const a = await eng.propose({ postId: "p1", agent: A }); assert.ok(a.ok); assert.equal(a.comment.moderation, "pending");
  assert.equal((await eng.propose({ postId: "p1", agent: B, parentId: a.comment.id })).reason, "INVALID_PARENT");   // parent not approved yet
  await moderate(db, { founderUid: "founder-uid", commentId: a.comment.id, decision: "approved" });
  const b = await eng.propose({ postId: "p1", agent: B, parentId: a.comment.id }); assert.ok(b.ok); assert.equal(b.comment.depth, 1);
  assert.equal((await eng.propose({ postId: "p1", agent: C })).reason, "GUARD_SIMILAR");          // near-copy of A
  assert.equal((await eng.propose({ postId: "p1", agent: D })).reason, "GUARD_IMPERSONATION");
  assert.equal((await eng.propose({ postId: "p1", agent: A })).reason, "ONE_TOP_LEVEL_PER_AGENT");
  assert.equal((await eng.propose({ postId: "p1", agent: A, parentId: a.comment.id })).reason, "NO_SELF_REPLY");
  assert.ok((await eng.propose({ postId: "p1", agent: E })).ok);
});
test("kill switch, revoke, per-post cap, quota 50% and governance deny", async () => {
  const db = memDb(); await killSwitch(db, { founderUid: "f", enabled: false });
  assert.equal((await mk(db).propose({ postId: "p1", agent: A })).reason, "KILL_SWITCH_OFF");
  const db2 = memDb({ revoked_agents: ["ag-0001"] }); assert.equal((await mk(db2).propose({ postId: "p1", agent: A })).reason, "AGENT_REVOKED");
  const db3 = memDb(); db3.s.posts.p1.ai_comment_cap = 0; assert.equal((await mk(db3).propose({ postId: "p1", agent: A })).reason, "POST_CAP_REACHED");
  assert.equal((await mk(memDb(), { quotaOk: false }).propose({ postId: "p1", agent: A })).reason, "QUOTA:POOL_HALF_EXHAUSTED");
  assert.equal((await mk(memDb(), { gov: false }).propose({ postId: "p1", agent: A })).reason, "GOVERNANCE:DENY");
  await assert.rejects(moderate(memDb(), { founderUid: "f", commentId: "x", decision: "delete" }), /INVALID_DECISION/);
});
test("LOCAL Postgres: discussion schema constraints", async (t) => {
  let PGlite; try { ({ PGlite } = await import("@electric-sql/pglite")); } catch { t.skip("pglite not installed"); return; }
  const { readFileSync } = await import("node:fs"); const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(readFileSync(new URL("../aivault/dawn/discussion-schema.sql", import.meta.url), "utf8"));
  const p = (await db.query(`insert into dawn_posts(author_user_id,title,body,ai_discussion_enabled) values (gen_random_uuid(),'t','b',true) returning id`)).rows[0].id;
  const h = "a".repeat(64);
  await db.query(`insert into dawn_ai_comments(post_id,ai_agent_id,ai_display_name,body,content_sha256) values ($1,'ag-1','x','hello',$2)`, [p, h]);
  await assert.rejects(db.query(`insert into dawn_ai_comments(post_id,ai_agent_id,ai_display_name,body,content_sha256) values ($1,'ag-2','y','hello',$2)`, [p, h]));        // sha dedupe
  await assert.rejects(db.query(`insert into dawn_ai_comments(post_id,ai_agent_id,ai_display_name,body,content_sha256) values ($1,'ag-1','x','other',$2)`, [p, "b".repeat(64)])); // one top-level per AI
  await assert.rejects(db.query(`insert into dawn_ai_comments(post_id,ai_agent_id,ai_display_name,body,content_sha256) values ($1,'evil bot','x','z',$2)`, [p, "c".repeat(64)])); // id format
  await assert.rejects(db.exec(`update dawn_ai_comments set moderation='approved'`), /approved_needs_moderator/);
  assert.equal((await db.query(`select enabled from dawn_ai_discussion_control`)).rows[0].enabled, false);
});
