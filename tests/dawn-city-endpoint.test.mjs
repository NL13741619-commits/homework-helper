import test from 'node:test';
import assert from 'node:assert/strict';
let handler,config,providerCalls=0,owner=true,upstream,client;
const policy={provider:'gemini',model:'test-text',approved:true,billing_mode:'free_only',quota_evidence_id:'e1',license_evidence_id:'e2',context_transfer_authorized:true,valid_until:'2099-01-01',live_model:'test-live',live_approved:true,live_quota_evidence_id:'e3'};
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',GEMINI_API_KEY:'test-key'})[n]},serve:fn=>handler=fn,upgradeWebSocket:()=>{client={readyState:1,sent:[],send(m){this.sent.push(JSON.parse(m));},close(){this.readyState=3;}};return {socket:client,response:new Response('upgrade mock')};}};
globalThis.EdgeRuntime={waitUntil:()=>{}};
globalThis.WebSocket=class{constructor(){this.readyState=1;this.sent=[];upstream=this;}send(s){this.sent.push(JSON.parse(s));}close(){this.readyState=3;}};
globalThis.fetch=async(url)=>{
 if(url.includes('/auth/v1/user'))return Response.json({id:'owner-id',is_anonymous:false,app_metadata:{role:owner?'owner':'member'}});
 if(url.includes('/rest/v1/'))return Response.json([config]);
 if(url.includes('generateContent')){providerCalls++;return Response.json({candidates:[{content:{parts:[{text:'真實測試回覆'}]}}]});}
 throw Error('UNEXPECTED_FETCH');
};
await import('../supabase/functions/dawn-city-ai/index.ts');
const headers={origin:'https://nl13741619-commits.github.io',authorization:'Bearer '+'A'.repeat(40),'content-type':'application/json'};
const request=b=>handler(new Request('https://test.supabase.co/functions/v1/dawn-city-ai',{method:'POST',headers,body:JSON.stringify(b)}));
test('auth denial, owner permission, health gating, actual chat, live setup and cleanup',async()=>{
 config={enabled:true,model_policy:policy};
 const missing=await handler(new Request('https://test.supabase.co',{method:'POST',body:'{}'}));assert.equal(missing.status,401);
 owner=false;assert.equal((await request({action:'health'})).status,403);owner=true;
 config={enabled:true,model_policy:{provider:'gemini',model:null,approved:false}};
 assert.equal((await (await request({action:'health'})).json()).chat,false);
 assert.equal((await request({action:'chat',agent_id:'dawn-light',message:'你好'})).status,409);assert.equal(providerCalls,0);
 config={enabled:true,model_policy:policy};
 const reply=await (await request({action:'chat',agent_id:'dawn-light',message:'你好'})).json();assert.equal(reply.inference_executed,true);assert.equal(reply.content,'真實測試回覆');assert.equal(providerCalls,1);
 assert.equal((await request({action:'chat',agent_id:'admin',message:'你好'})).status,400);
 const req=new Request('https://test.supabase.co/functions/v1/dawn-city-ai?access_token='+'A'.repeat(40)+'&agent_id=dawn-light&voice=Aoede&video=1',{headers:{upgrade:'websocket',origin:headers.origin}});
 await handler(req);client.onopen();upstream.onopen();assert.equal(upstream.sent[0].setup.model,'models/test-live');assert.equal(upstream.sent[0].setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Aoede');
 await upstream.onmessage({data:JSON.stringify({setupComplete:{}})});assert.equal(client.sent[0].type,'ready');
 client.onmessage({data:JSON.stringify({type:'audio',data:'YWJj'})});assert.equal(upstream.sent.at(-1).realtimeInput.audio.mimeType,'audio/pcm;rate=16000');
 client.onclose();assert.equal(upstream.readyState,3);assert.equal(client.readyState,3);
});
