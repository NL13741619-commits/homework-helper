import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime,inspectMessage,sha256} from '../runtime.mjs';
const env=n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'fixture-service-key':undefined;
const url='https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-dawn-runtime';
const req=(body,token='t'.repeat(40))=>new Request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
const json=x=>new Response(JSON.stringify(x));
test('real inbox filter requires fixed author/base/role, instruction and current expiry',()=>{
 const e={message_id:'fixture-message-001',from_base:'base-001',to_base:'base-002',recipient_agent:'dawn-light',reply_to:'https://github.com/m9wmtcb782-arch/AIVAULT/issues/30',kind:'instruction',sent_at:new Date().toISOString()};
 const c=overrides=>({id:123,user:{id:306819786},body:'<!-- AIVAULT-MESSAGE-V1 -->\n'+JSON.stringify({...e,...overrides})+'\n\nhello'});
 assert.equal(inspectMessage(c({})).accept,true);
 for(const overrides of [{kind:'receipt'},{kind:'result'},{recipient_agent:'darkstar'},{from_base:'base-003'},{sent_at:'2020-01-01T00:00:00Z'},{reply_to:'https://evil.invalid'}])assert.equal(inspectMessage(c(overrides)).accept,false);
 assert.equal(inspectMessage({...c({}),user:{id:305579832}}).accept,false);
});
test('public unauthenticated requests and scheduler submission fail closed',async()=>{
 let called=0;
 const handler=createRuntime({env,fetchImpl:async()=>{called++;return json({ok:true,kind:'scheduler',principal:'fixture-scheduler',enabled:true});}});
 const noAuth=await handler(new Request(url));assert.equal(noAuth.status,401);assert.equal(called,0);
 const response=await handler(req({action:'submit',kind:'hash_text',question:'x',idempotency_key:'fixture001'}));assert.equal(response.status,403);assert.equal(called,1);
 const cross=await handler(new Request(url,{method:'POST',headers:{Origin:'https://evil.invalid'}}));assert.equal(cross.status,403);
});
test('run-once performs literal hash tool and fenced completion with no model or shell',async()=>{
 const calls=[];
 const handler=createRuntime({env,fetchImpl:async(u,o)=>{
  const body=JSON.parse(o.body);calls.push({u,body});
  if(u.endsWith('aivault_dawn_auth'))return json({ok:true,kind:'controller',principal:'fixture-controller',enabled:true});
  switch(body.p_action){
   case 'tick_start':return json({ok:true,tick_token:'fixture-tick',last_poll_at:new Date().toISOString()});
   case 'claim':return json({ok:true,task_id:'fixture-task',fencing_token:'12',kind:'hash_text',question:'$(touch /tmp/should-never-execute)'});
   case 'renew':case 'finish':case 'tick_end':return json({ok:true});
   case 'outbox_next':return json({ok:true,item:null});
   default:throw Error('unexpected call');
  }
 }});
 const response=await handler(req({action:'run_once',poll:false}));const result=await response.json();assert.equal(response.status,200);
 assert.equal(result.task.evidence.result.sha256,await sha256('$(touch /tmp/should-never-execute)'));
 assert.equal(result.task.evidence.inference_executed,false);
 const finish=calls.find(c=>c.body.p_action==='finish');assert.equal(finish.body.p_body.fencing_token,'12');assert.equal(finish.body.p_body.status,'succeeded');
 assert.equal(calls.every(c=>c.u.startsWith('https://svtkpdmqemidlasowqew.supabase.co/rest/v1/rpc/')),true);
});
test('missing model generates a blocked result and concrete help, never a fabricated answer',async()=>{
 let finish;
 const handler=createRuntime({env,fetchImpl:async(u,o)=>{
  const b=JSON.parse(o.body);
  if(u.endsWith('aivault_dawn_auth'))return json({ok:true,kind:'controller',principal:'fixture-controller',enabled:true});
  if(u.endsWith('aivault_memory'))return json({ok:true,untrusted_memory:true,entries:[]});
  switch(b.p_action){
   case 'tick_start':return json({ok:true,tick_token:'fixture-tick'});
   case 'claim':return json({ok:true,task_id:'fixture-task',fencing_token:'13',kind:'qa',question:'17+25'});
   case 'renew':case 'tick_end':return json({ok:true});
   case 'model_reserve':return json({ok:false,error:'BLOCKED_NO_MODEL'});
   case 'finish':finish=b.p_body;return json({ok:true});
   case 'outbox_next':return json({ok:true,item:null});
   default:throw Error('unexpected');
  }
 }});
 const result=await (await handler(req({action:'run_once',poll:false}))).json();
 assert.equal(finish.status,'blocked');assert.equal(result.task.evidence.error,'BLOCKED_NO_MODEL');assert.equal(result.task.evidence.answer,undefined);
 assert.equal(result.task.evidence.help_request.help_id,'DAWN-MODEL-001');assert.equal(result.task.evidence.inference_executed,false);
});
test('correlated resume requires a valid task and fixed help ID',()=>{
 const e={message_id:'fixture-resume-001',from_base:'base-001',to_base:'base-002',recipient_agent:'dawn-light',reply_to:'https://github.com/m9wmtcb782-arch/AIVAULT/issues/30',kind:'instruction',sent_at:new Date().toISOString(),action:'resume_task',help_id:'DAWN-MODEL-001',task_id:'11111111-1111-4111-8111-111111111111'};
 const c=x=>({user:{id:306819786},body:'<!-- AIVAULT-MESSAGE-V1 -->\n'+JSON.stringify({...e,...x})});
 assert.equal(inspectMessage(c({})).resume,true);
 assert.equal(inspectMessage(c({task_id:'arbitrary'})).accept,false);
 assert.equal(inspectMessage(c({help_id:'paid-upgrade'})).accept,false);
});
test('unknown outbound POST is reconciled by marker without another POST',async()=>{
 const states=[];let posts=0;
 const handler=createRuntime({env:n=>n==='AIVAULT_GITHUB_TOKEN'?'fixture-communication-key':env(n),fetchImpl:async(u,o={})=>{
  if(u==='https://api.github.com/user')return json({id:305579832});
  if(u.startsWith('https://api.github.com/repos/m9wmtcb782-arch/AIVAULT/issues/30/comments')){
   if(o.method==='POST'){posts++;throw Error('must not post');}
   return json([{id:1234,user:{id:305579832},body:'<!-- fixture-marker -->\nresult'}]);
  }
  const b=JSON.parse(o.body);
  if(u.endsWith('aivault_dawn_auth'))return json({ok:true,kind:'controller',principal:'fixture-controller',enabled:true});
  switch(b.p_action){
   case 'tick_start':return json({ok:true,tick_token:'fixture-tick'});
   case 'tick_end':return json({ok:true});
   case 'claim':return json({ok:true,idle:true});
   case 'outbox_next':return json({ok:true,item:{id:'fixture-outbox',status:'unknown',marker:'fixture-marker',updated_at:new Date().toISOString()}});
   case 'outbox_state':states.push(b.p_body);return json({ok:true});
   default:throw Error('unexpected');
  }
 }});
 const r=await (await handler(req({action:'run_once',poll:false}))).json();
 assert.equal(r.outbox.status,'OUTBOX_RECONCILED');assert.equal(posts,0);assert.equal(states[0].comment_id,'1234');
});
