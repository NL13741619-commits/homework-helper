import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDawnMemory} from '../memory.mjs';

test('private memory pins instance and server principal for every operation',async()=>{
  const calls=[];
  const memory=createDawnMemory({principal:'fixture-dawn',rpc:async(...args)=>{calls.push(args);return args[0]==='recall'?{ok:true,untrusted_memory:true,entries:[{content:'fixture'}]}:{ok:true};}});
  await memory.status();await memory.append({title:'fixture',content:'data'});await memory.read('1');
  const result=await memory.recall('fixture',1);
  for(const call of calls){assert.equal(call[1],'fixture-dawn');assert.equal(call[2],'base-002:dawn-light');}
  assert.equal(result.untrusted_memory,true);assert.equal(result.instance_id,'base-002:dawn-light');
  assert.throws(()=>createDawnMemory({principal:'',rpc:()=>{}}));
});
test('recall is bounded and outages or invalid backend responses fail closed',async()=>{
  let calls=0;
  const memory=createDawnMemory({principal:'fixture-dawn',rpc:async()=>{calls++;return {ok:true,untrusted_memory:true,entries:[{content:'x'.repeat(1001)}]};}});
  await assert.rejects(memory.recall('x'.repeat(129)));await assert.rejects(memory.recall('',9));assert.equal(calls,0);
  await assert.rejects(memory.recall());assert.equal(calls,1);
  const failed=createDawnMemory({principal:'fixture-dawn',rpc:async()=>({ok:false,error:'secret backend detail'})});
  await assert.rejects(failed.status(),/^Error: DAWN_MEMORY_UNAVAILABLE$/);
});
