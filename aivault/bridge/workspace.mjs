import {lstat,realpath,readdir,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const locks=new Map();
// Prepare an empty private directory only. Does NOT run code or install models.
// root must be a dedicated host-owned directory, never a public upload path.
export async function prepareWorkspace(root,descriptor) {
  if(!path.isAbsolute(root) || !descriptor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(descriptor.task_id) ||
    !/^[0-9]{1,19}$/.test(descriptor.fencing_token) || typeof descriptor.principal!=='string' ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(descriptor.principal) || !/^ch-\d{4}$/.test(descriptor.channel_id) ||
    Number(descriptor.channel_id.slice(3))<1 || Number(descriptor.channel_id.slice(3))>1000) throw Error('Invalid workspace descriptor');
  const info=await lstat(root);
  if(!info.isDirectory() || info.isSymbolicLink()) throw Error('Dedicated private root required');
  const canonical=await realpath(root);
  const previous=locks.get(canonical)||Promise.resolve();
  let release;const held=new Promise(r=>{release=r;});locks.set(canonical,held);
  await previous;
  try {
    if((await readdir(canonical)).length>=8) throw Error('Workspace capacity');
    const directory=await mkdtemp(path.join(canonical,`${descriptor.task_id}-${descriptor.fencing_token}-`));
    for(const child of ['src','config','prompts','tests','evidence']) await mkdir(path.join(directory,child),{mode:0o700});
    const manifest={schema_version:1,...Object.fromEntries(['task_id','fencing_token','principal','channel_id'].map(k=>[k,descriptor[k]])),mode:'dry_run',code_execution:false,model_inference:false};
    await writeFile(path.join(directory,'workspace.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
    return {directory,manifest};
  } finally {release();if(locks.get(canonical)===held)locks.delete(canonical);}
}
