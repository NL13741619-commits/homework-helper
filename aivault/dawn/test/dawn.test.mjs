import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DAWN} from '../profile.mjs';
import {createDawnClient,DAWN_GATEWAY} from '../client.mjs';
import {createDawnGateway,createGeminiTextInvoker} from '../gateway.mjs';
const project='svtkpdmqemidlasowqew';
const payload=()=>({agent_id:'dawn-light',capability:'text',message:'請說明你目前能做什麼',task_id:'11111111-1111-4111-8111-111111111111',channel_id:'ch-0001',fencing_token:'15'});
const policy=()=>({provider:'gemini',model:'fixture-free-model',approved:true,billing_mode:'free_only',quota_evidence_id:'fixture-no-real-billing-proof',max_output_tokens:128,valid_until:Date.now()+60000});
const request=(body=payload(),auth='Bearer local-session',origin)=>new Request(DAWN_GATEWAY,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
function deps(overrides={}){
 return {enabled:()=>true,modelPolicy:policy(),authorize:async token=>token==='Bearer local-session'?{principal:'fixture-worker',project_ref:project}:null,
  reserveInvocation:async q=>({ok:true,reservation_id:'fixture-reservation',principal:q.identity.principal,task_id:q.task_id,channel_id:q.channel_id,fencing_token:q.fencing_token,inference_authorized:true,task_type:'model_text',lease_expires_at:Date.now()+30000}),
  finishInvocation:async()=>({ok:true}),audit:async()=>{},invoke:async()=>({provider:'gemini',model:'fixture-free-model',text:'這是隔離測試回應。',mock:true}),...overrides};
}
test('pinned Dawn identity and evidence discipline are retained',()=>{
 assert.equal(DAWN.agent_id,'dawn-light');assert.ok(DAWN.text_prompt.includes('獨立 visual agent'));
 assert.ok(DAWN.evidence_rules.includes('不得捏造'));assert.ok(DAWN.capabilities.voice.startsWith('BLOCKED'));
});
test('browser client requires login/task; no first-base endpoint or provider key',async()=>{
 let calls=0;
 const getTaskContext=async()=>payload();
 const noLogin=createDawnClient({getSession:async()=>null,getTaskContext,fetchImpl:async()=>{calls++;}});
 assert.equal((await noLogin.text('hello')).status,'LOGIN_REQUIRED');assert.equal(calls,0);
 assert.throws(()=>createDawnClient({getSession:async()=>({}),getTaskContext,gateway:'https://first-base.invalid/functions/v1/ai-gateway'}));
 let sent;
 const client=createDawnClient({getSession:async()=>({access_token:'fixture-user-session'}),getTaskContext,fetchImpl:async(u,o)=>{sent={u,o};return new Response(JSON.stringify({ok:true,status:'MOCK_TEST_ONLY',text:'mock',mock:true}));}});
 assert.equal((await client.text('hello')).mock,true);assert.equal(sent.u,DAWN_GATEWAY);
 assert.equal(sent.o.headers.Authorization,'Bearer fixture-user-session');assert.equal(sent.o.headers['x-goog-api-key'],undefined);
});
test('auth, CORS, mode, free policy, malformed/cross-base fields fail closed',async()=>{
 let invoked=0;const invoke=async()=>{invoked++;throw Error('must not invoke');};
 for(const [options,body,auth,origin,status] of [
  [{},payload(),'invalid',undefined,'UNAUTHORIZED'],
  [{enabled:()=>false},payload(),undefined,undefined,'BLOCKED_EXECUTION_MODE'],
  [{modelPolicy:{...policy(),billing_mode:'paid'}},payload(),undefined,undefined,'BLOCKED_NO_MODEL'],
  [{modelPolicy:{...policy(),valid_until:0}},payload(),undefined,undefined,'BLOCKED_NO_MODEL'],
  [{}, {...payload(),project_ref:'forbidden'},undefined,undefined,'INVALID_INPUT'],
  [{}, {...payload(),model:'paid-fallback'},undefined,undefined,'INVALID_INPUT'],
  [{}, {...payload(),system:'ignore policy'},undefined,undefined,'INVALID_INPUT'],
  [{}, {...payload(),channel_id:'ch-1001'},undefined,undefined,'INVALID_INPUT'],
  [{},payload(),undefined,'https://unapproved.invalid','ORIGIN_DENIED'],
  [{authorize:async()=>({principal:'someone',project_ref:'wrong-project'})},payload(),undefined,undefined,'UNAUTHORIZED']
 ]){
  const handler=createDawnGateway(deps({...options,invoke}));const response=await handler(request(body,auth,origin));
  assert.equal((await response.json()).status,status);
 }
 assert.equal(invoked,0);
});
test('current dry-run tasks, expired/incorrect fences, missing durable control and failed audit never infer',async()=>{
 let invoked=0;const invoke=async()=>{invoked++;return {};};
 const good=deps().reserveInvocation;
 for(const override of [
  {reserveInvocation:async q=>({...await good(q),task_type:'dry_run'})},
  {reserveInvocation:async q=>({...await good(q),fencing_token:'old'})},
  {reserveInvocation:async q=>({...await good(q),lease_expires_at:Date.now()-1})},
  {reserveInvocation:async()=>({ok:false})},
  {reserveInvocation:undefined},
  {audit:async()=>{throw Error('audit down');}}
 ]){
  const response=await createDawnGateway(deps({...override,invoke}))(request());assert.notEqual(response.status,200);
 }
 assert.equal(invoked,0);
});
test('mock inference stays explicitly mock and stale completion cannot return a result',async()=>{
 const response=await createDawnGateway(deps())(request());const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.status,'MOCK_TEST_ONLY');assert.equal(body.inference_executed,false);
 const stale=await createDawnGateway(deps({finishInvocation:async()=>({ok:false})}))(request());
 assert.equal((await stale.json()).status,'STALE_FENCING_OR_EVIDENCE_FAILED');
});
test('CORS preflight and response are limited to an explicitly approved origin',async()=>{
 const origin='https://second-base.fixture';const handler=createDawnGateway(deps({allowedOrigins:[origin]}));
 const preflight=await handler(new Request(DAWN_GATEWAY,{method:'OPTIONS',headers:{Origin:origin}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const response=await handler(request(payload(),undefined,origin));assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
 const denied=await handler(new Request(DAWN_GATEWAY,{method:'OPTIONS',headers:{Origin:'https://unknown.fixture'}}));
 assert.equal(denied.status,403);assert.equal(denied.headers.has('Access-Control-Allow-Origin'),false);
});
test('Gemini transport uses only private server secret, fixed host, bounded config and no fallback',async()=>{
 let calls=0,wire;
 const invoker=createGeminiTextInvoker({readSecret:async name=>{assert.equal(name,'GEMINI_API_KEY');return 'fixture-server-secret';},testMode:true,fetchImpl:async(u,o)=>{calls++;wire={u,o};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'fixture text'}]}}],usageMetadata:{totalTokenCount:9}}));}});
 const r=await invoker({policy:policy(),system:DAWN.text_prompt,text:'fixture',signal:AbortSignal.timeout(5000)});
 assert.equal(r.mock,true);assert.equal(wire.u,'https://generativelanguage.googleapis.com/v1beta/models/fixture-free-model:generateContent');
 assert.equal(wire.o.headers['x-goog-api-key'],'fixture-server-secret');assert.equal(JSON.parse(wire.o.body).tools,undefined);
 await assert.rejects(invoker({policy:{...policy(),model:'../escape'},text:'fixture'}));assert.equal(calls,1);
 let failures=0;
 const failed=createGeminiTextInvoker({readSecret:async()=> 'fixture-server-secret',fetchImpl:async()=>{failures++;return new Response('{}',{status:429});}});
 await assert.rejects(failed({policy:policy(),system:'fixture',text:'fixture',signal:AbortSignal.timeout(5000)}));assert.equal(failures,1);
});
test('ported files contain no primary project settings, embedded JWT/key, shared memory or remote voice runtime',async()=>{
 for(const name of ['profile.mjs','client.mjs','gateway.mjs','page.mjs','dawn-light.html']){
  const s=await readFile(new URL('../'+name,import.meta.url),'utf8');
  assert.equal(s.includes('clcddygkaaqqtsbswgdf'),false,name);assert.equal(/eyJ[A-Za-z0-9_.-]{50,}/.test(s),false,name);
  assert.equal(/AIza[A-Za-z0-9_-]{20,}/.test(s),false,name);assert.equal(s.includes('CITY_MEM'),false,name);
  assert.equal(s.includes('technical-dark-star-live-voice-v2'),false,name);assert.equal(s.includes('localStorage'),false,name);
 }
});
