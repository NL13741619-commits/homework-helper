import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export const PROJECT = 'svtkpdmqemidlasowqew';
export const REPOSITORY = 'NL13741619-commits/homework-helper';
const equal = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export function validateCommand(c, now = Date.now()) {
  const keys = (x, expected) => x && typeof x === 'object' && !Array.isArray(x) &&
    Object.keys(x).sort().join(',') === [...expected].sort().join(',');
  if (!keys(c, ['command_id', 'sender', 'recipient', 'nonce', 'issued_at', 'expires_at', 'task_type', 'payload'])) return 'MALFORMED_PAYLOAD';
  if (c.sender !== 'base1' || c.recipient !== 'base2') return 'UNAUTHORIZED_SENDER';
  if (c.task_type !== 'dry_run' || !['command_id','nonce','issued_at','expires_at'].every(k => typeof c[k] === 'string') ||
      !/^[a-zA-Z0-9_-]{8,128}$/.test(c.command_id) || !/^[a-zA-Z0-9_-]{16,128}$/.test(c.nonce)) return 'MALFORMED_PAYLOAD';
  const p = c.payload;
  if (!keys(p, ['repository', 'project_ref', 'branch', 'mode', 'model', 'tests'])) return 'MALFORMED_PAYLOAD';
  if (p.repository !== REPOSITORY || p.project_ref !== PROJECT) return 'PROTECTED_TARGET';
  if (p.branch !== 'feature/aivault-rebuild') return 'DIRECT_MAIN_OR_BRANCH_DENIED';
  if (p.model !== 'none') return 'MODEL_REQUEST_DENIED';
  if (p.mode !== 'mock' || JSON.stringify(p.tests) !== '["bridge_contract_v1"]') return 'PAYLOAD_POLICY_DENIED';
  const issued = Date.parse(c.issued_at), expires = Date.parse(c.expires_at);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= now || expires > now + 600_000 || issued > now + 30_000 || issued < now - 300_000 || expires <= issued) return 'EXPIRED_COMMAND';
  return null;
}

// No subprocess, model request, arbitrary SQL, git write, or payload-driven execution.
export function createIntake({ tokens, rpc, enabled = () => false, audit = event => console.error(JSON.stringify(event)) }) {
  if (!tokens?.base1 || !tokens?.runner || tokens.base1.length < 32 || tokens.runner.length < 32 || tokens.base1 === tokens.runner) throw Error('Distinct server credentials required');
  let active = 0;
  const windows = new Map();
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
    if (!enabled()) return send(503, {error:'KILL_SWITCH'});
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const actor = equal(token, tokens.base1) ? 'base1' : equal(token, tokens.runner) ? 'runner-dry-run' : null;
    if (!actor) { audit({event:'bridge.transport_rejected',reason:'UNAUTHORIZED_SENDER'}); return send(401,{error:'UNAUTHORIZED_SENDER'}); }
    const minute = Math.floor(Date.now()/60_000), rate = windows.get(actor);
    const count = rate?.minute === minute ? rate.count+1 : 1;
    windows.set(actor,{minute,count});
    if (active >= 8 || count > 60) return send(429,{error:'RESOURCE_LIMIT'});
    if (req.method !== 'POST' || !['/commands','/claim','/finish'].includes(req.url)) return send(404,{error:'ROUTE_DENIED'});
    const action = {'/commands':'intake','/claim':'claim','/finish':'finish'}[req.url];
    if ((action === 'intake') !== (actor === 'base1')) return send(403,{error:'ACTION_DENIED'});
    active++;
    try {
      const chunks=[]; let bytes=0;
      for await (const chunk of req) { bytes += chunk.length; if(bytes>16384) {send(413,{error:'RESOURCE_LIMIT'}); return;} chunks.push(chunk); }
      let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400,{error:'MALFORMED_PAYLOAD'}); }
      if (action === 'intake') {
        const error=validateCommand(body);
        if(error) {
          // SQL validates again and persists rejection without storing untrusted content.
          await rpc(action,actor,body);
          return send(400,{error});
        }
      }
      if(!enabled()) return send(503,{error:'KILL_SWITCH'});
      const result=await rpc(action,actor,body);
      send(result.ok?200:409,result);
    } catch { send(503,{error:'BACKEND_UNAVAILABLE'}); }
    finally { active--; }
  });
  server.requestTimeout=5000; server.headersTimeout=5000; server.timeout=5000;
  server.keepAliveTimeout=1000; server.maxConnections=16; server.maxRequestsPerSocket=10;
  return server;
}

export function supabaseRpc({ url, key, fetchImpl = fetch }) {
  if(url !== `https://${PROJECT}.supabase.co` || !key) throw Error('Second-base server credentials required');
  return async (action, actor, body) => {
    const response=await fetchImpl(`${url}/rest/v1/rpc/aivault_bridge`, {
      method:'POST', signal:AbortSignal.timeout(3000),
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:action,p_actor:actor,p_body:body})
    });
    if(!response.ok) throw Error('RPC unavailable');
    return response.json();
  };
}

// Deliberately no autostart. A private host must supply credentials and wire this
// factory, default-disabled, behind TLS. No service or secret is deployed here.
