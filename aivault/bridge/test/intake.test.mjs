import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntake, validateCommand, supabaseRpc, PROJECT, REPOSITORY } from '../intake.mjs';
const command=()=>({command_id:'mock_command_001',sender:'base1',recipient:'base2',nonce:'mock_nonce_00000001',issued_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),task_type:'dry_run',payload:{repository:REPOSITORY,project_ref:PROJECT,branch:'feature/aivault-rebuild',mode:'mock',model:'none',tests:['bridge_contract_v1']}});
test('strict allowlist and untrusted payload policy',()=>{
  assert.equal(validateCommand(command()),null);
  for(const [mutate,expected] of [
    [c=>c.sender='intruder','UNAUTHORIZED_SENDER'],
    [c=>c.expires_at=new Date(0).toISOString(),'EXPIRED_COMMAND'],
    [c=>c.payload=null,'MALFORMED_PAYLOAD'],
    [c=>c.payload.repository='NL13741619-commits/safe-reunion','PROTECTED_TARGET'],
    [c=>c.payload.repository='NL13741619-commits/safe-reunion-login','PROTECTED_TARGET'],
    [c=>c.payload.project_ref='perfsipperncvjocznhl','PROTECTED_TARGET'],
    [c=>c.payload.branch='main','DIRECT_MAIN_OR_BRANCH_DENIED'],
    [c=>c.payload.model='paid-model','MODEL_REQUEST_DENIED'],
    [c=>c.payload.tests=['sh -c evil'],'PAYLOAD_POLICY_DENIED'],
    [c=>c.payload.shell='echo evil','MALFORMED_PAYLOAD'],
    [c=>c.command_id=12345678,'MALFORMED_PAYLOAD'],
    [c=>c.nonce=[], 'MALFORMED_PAYLOAD']
    ,[c=>c.issued_at='now','MALFORMED_PAYLOAD']
  ]) {const c=command(); mutate(c); assert.equal(validateCommand(c),expected);}
});
test('HTTP auth, kill switch, limits, actor binding and RPC flow',async()=>{
  let enabled=false; const calls=[];
  const server=createIntake({tokens:{base1:'a'.repeat(32),runner:'b'.repeat(32)},enabled:()=>enabled,rpc:async(...args)=>{calls.push(args);return {ok:true,status:'mock'};}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(route,body,token='a'.repeat(32))=>fetch(url+route,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  try {
    assert.equal((await post('/commands',command())).status,503);
    enabled=true;
    assert.equal((await post('/commands',command(),'bad')).status,401);
    assert.equal((await post('/claim',{},'a'.repeat(32))).status,403);
    assert.equal((await post('/commands',command(),'b'.repeat(32))).status,403);
    assert.equal((await post('/commands',command())).status,200);
    assert.equal(calls[0][1],'base1');
    assert.equal((await post('/commands',{data:'x'.repeat(17000)})).status,413);
    enabled=false;
    assert.equal((await post('/finish',{},'b'.repeat(32))).status,503);
    assert.equal(calls.length,1);
  } finally { await new Promise(r=>server.close(r)); }
});
test('backend outage fails closed; protected endpoint never contacted',async()=>{
  assert.throws(()=>supabaseRpc({url:'https://perfsipperncvjocznhl.supabase.co',key:'mock'}));
  let request;
  const rpc=supabaseRpc({url:`https://${PROJECT}.supabase.co`,key:'mock',fetchImpl:async(u,o)=>{request={u,o};return {ok:false};}});
  await assert.rejects(rpc('claim','runner-dry-run',{}));
  assert.equal(JSON.parse(request.o.body).p_actor,'runner-dry-run');
  assert.ok(request.o.signal);
});
