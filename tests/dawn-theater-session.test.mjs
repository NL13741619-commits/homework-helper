import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app/dawn-theater-session.js', import.meta.url), 'utf8').replace("import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm')", 'loadSdk()');
async function run({ user = null, offline = false } = {}) {
  let callback; let verified = 0;
  const events = [];
  const client = { auth: {
    onAuthStateChange: fn => { callback = fn; },
    getSession: async () => ({ data: { session: user ? { user } : null } }),
    getUser: async () => { verified++; return { data: { user } }; }
  }};
  const context = {
    document: { documentElement: { classList: { toggle() {} } } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    AIVAULT_AUTH_CONFIG: { url: 'https://test.invalid', key: 'public' },
    dispatchEvent: event => events.push(event),
    loadSdk: async () => { if (offline) throw Error('offline'); return { createClient: () => client }; }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const result = await context.AIVAULT_AUTH_READY;
  return { context, result, events, callback, verified };
}
test('guest keeps public access without creating or verifying an account', async () => {
  const r = await run(); assert.ok(r.result); assert.equal(r.context.AIVAULT_USER, null); assert.equal(r.verified, 0);
});
test('SDK failure leaves guest identity and does not require login', async () => {
  const r = await run({ offline: true }); assert.equal(r.result, null); assert.equal(r.context.AIVAULT_USER, null);
});
test('member identity is verified and signout returns to guest without redirect', async () => {
  const r = await run({ user: { id: 'member' } }); assert.equal(r.verified, 1); assert.equal(r.context.AIVAULT_USER.id, 'member');
  r.callback('SIGNED_OUT', null); assert.equal(r.context.AIVAULT_USER, null); assert.equal(r.events.at(-1).detail, null);
});
