import {test} from 'node:test';
import assert from 'node:assert/strict';
import {protect} from './media-auth.mjs';
const origin='https://nl13741619-commits.github.io';
const token='a'.repeat(40);
const req=(authorization, o=origin)=>new Request('https://example.test',{method:'POST',headers:{origin:o,...(authorization?{authorization}: {})}});
test('missing credential and hostile origin cannot execute a model',async()=>{
 let calls=0;
 const fn=protect(()=>{calls++;return new Response('ok')},{fetchImpl:()=>{throw Error('must not verify')}});
 assert.equal((await fn(req())).status,401);
 assert.equal((await fn(req('Bearer '+token,'https://evil.test'))).status,403);
 assert.equal(calls,0);
});
test('only main-city Auth verifies identity; forged or unavailable identity fails closed',async()=>{
 let calls=0;
 for(const mode of ['invalid','unavailable','member','anonymous','owner']){
  const fn=protect(()=>{calls++;return new Response('ok')},{fetchImpl:async(url,options)=>{
   assert.equal(url,'https://clcddygkaaqqtsbswgdf.supabase.co/auth/v1/user');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   assert.ok(options.headers.apikey);
   if(mode==='unavailable')throw Error('offline');
   if(mode==='invalid')return new Response('{}',{status:401});
   return Response.json({id:'verified-user',is_anonymous:mode==='anonymous',app_metadata:{role:mode==='member'?'user':'owner'},user_metadata:{role:'owner'}});
  }});
  const r=await fn(req('Bearer '+token));
  assert.equal(r.status,({invalid:401,unavailable:503,member:403,anonymous:403,owner:200})[mode]);
 }
 assert.equal(calls,1);
});
