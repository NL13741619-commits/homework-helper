import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStatus,summarizeRuntime} from './status.mjs';
const now=Date.parse('2026-10-23T10:20:00Z');
test('observer reads never renew a stale worker heartbeat',()=>{
 const row={instance_id:'base-002:dawn-light',enabled:true,last_tick_at:'2026-10-23T10:00:00Z',model_policy:{approved:false}};
 const r=summarizeRuntime(row,now);assert.equal(r.state,'STALE');assert.equal(r.age_seconds,1200);assert.equal(r.last_tick_at,row.last_tick_at);assert.equal(r.model_approved,false);
 assert.equal(summarizeRuntime({...row,last_tick_at:'2026-10-23T10:15:00Z'},now).state,'BACKEND_ALIVE');
 assert.equal(summarizeRuntime({...row,enabled:false},now).state,'DISABLED');
 assert.equal(summarizeRuntime({...row,last_tick_at:null},now).state,'UNKNOWN');
});
test('health check performs only a database read and HEAD, never model inference or writes',async()=>{
 const calls=[];
 const handler=createStatus({env:n=>({SUPABASE_URL:'https://second.test',SUPABASE_SERVICE_ROLE_KEY:'private',SUPABASE_ANON_KEY:'public'})[n],now:()=>now,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/rest/'))return Response.json([{enabled:true,last_tick_at:'2026-10-23T10:15:00Z',model_policy:{approved:false}}]);
  assert.equal(options.method,'HEAD');return new Response(null,{status:404});
 }});
 const response=await handler();const data=await response.json();assert.equal(response.status,200);assert.equal(data.runtime.state,'BACKEND_ALIVE');assert.equal(data.gateway,'NOT_DEPLOYED');assert.equal(data.model_inference_executed,false);assert.equal(calls.length,2);assert.ok(!JSON.stringify(data).includes('private'));
});
test('database failure cannot report an alive heartbeat',async()=>{
 const handler=createStatus({env:()=> 'configured',fetchImpl:async()=>new Response(null,{status:500})});
 const response=await handler();assert.equal(response.status,503);assert.equal((await response.json()).runtime,undefined);
});
