import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,lstat,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareWorkspace} from '../workspace.mjs';
const descriptor={task_id:'11111111-1111-4111-8111-111111111111',fencing_token:'5',principal:'helper-001',channel_id:'ch-0001'};
test('private per-task/fence workspace; no execution or model activation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'aivault-workspace-test-'));
 try{
  const a=await prepareWorkspace(root,descriptor);
  const b=await prepareWorkspace(root,{...descriptor,fencing_token:'6'});
  assert.notEqual(a.directory,b.directory);
  assert.deepEqual((await readdir(a.directory)).sort(),['config','evidence','prompts','src','tests','workspace.json']);
  assert.equal((await lstat(a.directory)).mode&0o777,0o700);
  assert.equal(JSON.parse(await readFile(path.join(a.directory,'workspace.json'),'utf8')).code_execution,false);
  await assert.rejects(prepareWorkspace(root,{...descriptor,task_id:'../../main'}));
  await assert.rejects(prepareWorkspace(root,{...descriptor,fencing_token:'5;evil'}));
  await assert.rejects(prepareWorkspace(root,{...descriptor,channel_id:'ch-1001'}));
  const parallel=await Promise.allSettled(Array.from({length:10},()=>prepareWorkspace(root,descriptor)));
  assert.equal(parallel.filter(x=>x.status==='fulfilled').length,6);
  assert.equal((await readdir(root)).length,8);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('symlink workspace root is refused',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'aivault-symlink-test-'));
 const link=`${root}-link`;
 try{await symlink(root,link);await assert.rejects(prepareWorkspace(link,descriptor));}
 finally{await rm(link,{force:true});await rm(root,{recursive:true,force:true});}
});
