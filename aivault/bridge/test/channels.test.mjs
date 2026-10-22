import {test} from 'node:test';
import assert from 'node:assert/strict';
import {channelIds,createChannelIntake,channelRpc} from '../channels.mjs';
const credentials=[{principal:'base1',token:'a'.repeat(32)},{principal:'helper-001',token:'b'.repeat(32)}];
test('exactly 1000 bounded logical channel routes',()=>{
  assert.equal(channelIds.length,1000);assert.equal(new Set(channelIds).size,1000);
  assert.equal(channelIds[0],'ch-0001');assert.equal(channelIds.at(-1),'ch-1000');
  assert.ok(Object.isFrozen(channelIds));
});
test('credentials are distinct per service principal',()=>{
  assert.throws(()=>createChannelIntake({credentials:[],rpc:()=>{}}));
  assert.throws(()=>createChannelIntake({credentials:[credentials[0],credentials[0]],rpc:()=>{}}));
  assert.throws(()=>createChannelIntake({credentials:[credentials[0],{principal:'other',token:credentials[0].token}],rpc:()=>{}}));
});
test('channel route, principal binding, feedback, limits and fail-closed outage',async()=>{
  let enabled=false,fail=false;const calls=[];
  const server=createChannelIntake({credentials,enabled:()=>enabled,audit:()=>{},rpc:async(...args)=>{calls.push(args);if(fail)throw Error('offline');return {ok:true,status:'blocked',model_status:'BLOCKED_NO_MODEL'};}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(route,body,token=credentials[0].token)=>fetch(url+route,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  try{
    assert.equal((await post('/channels/ch-0001/status',{})).status,503);
    enabled=true;
    assert.equal((await post('/channels/ch-0001/status',{},'wrong')).status,401);
    assert.equal((await post('/channels/ch-1001/status',{})).status,404);
    assert.equal((await post('/commands',{})).status,404);
    assert.equal((await post('/channels/ch-0001/commands',{})).status,400);
    assert.equal(calls.length,0);
    for(const id of ['ch-0001','ch-1000']){
      const response=await post(`/channels/${id}/status`,{task_id:'mock-task'},credentials[1].token);
      assert.equal(response.status,200);assert.equal((await response.json()).model_status,'BLOCKED_NO_MODEL');
      assert.deepEqual(calls.at(-1).slice(0,3),['status','helper-001',id]);
    }
    assert.equal((await post('/channels/ch-0001/status',{data:'x'.repeat(17000)})).status,413);
    fail=true;
    assert.equal((await post('/channels/ch-0001/status',{})).status,503);
    enabled=false;
    const before=calls.length;
    assert.equal((await post('/channels/ch-0001/claim',{})).status,503);assert.equal(calls.length,before);
  }finally{await new Promise(r=>server.close(r));}
});
test('channel RPC pins backend and carries no caller-selected authority',async()=>{
  assert.throws(()=>channelRpc({url:'https://perfsipperncvjocznhl.supabase.co',key:'test'}));
  let args;
  const rpc=channelRpc({url:'https://svtkpdmqemidlasowqew.supabase.co',key:'mock',fetchImpl:async(...a)=>{args=a;return {ok:true,json:async()=>({ok:true})};}});
  await rpc('status','helper-001','ch-0001',{task_id:'mock'});
  const envelope=JSON.parse(args[1].body);assert.equal(envelope.p_principal,'helper-001');assert.equal(envelope.p_channel,'ch-0001');
  assert.ok(args[1].signal);
});
