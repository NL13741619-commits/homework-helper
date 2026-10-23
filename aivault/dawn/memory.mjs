import {DAWN_INSTANCE} from './instance.mjs';

// Private-server adapter. principal is verified by the host, not a browser field.
// RPC implementation must use the second-base aivault_memory endpoint only.
export function createDawnMemory({principal,rpc}) {
  if(!/^[A-Za-z0-9_-]{3,128}$/.test(principal||'') || typeof rpc!=='function') throw Error('Verified server principal and RPC required');
  const call=async(action,body)=>{
    const result=await rpc(action,principal,DAWN_INSTANCE.instance_id,body);
    if(result?.ok!==true) throw Error('DAWN_MEMORY_UNAVAILABLE');
    return result;
  };
  return Object.freeze({
    instance_id:DAWN_INSTANCE.instance_id,
    status:()=>call('status',{}),
    append:record=>call('append',record),
    read:(entry_id,{offset=0,limit=4000}={})=>call('read',{entry_id,offset,limit}),
    recall:async(query='',limit=4)=>{
      if(typeof query!=='string' || Array.from(query).length>128 || !Number.isInteger(limit) || limit<1 || limit>8) throw Error('Invalid memory query');
      const result=await call('recall',{query,limit});
      if(result.untrusted_memory!==true || !Array.isArray(result.entries) || result.entries.length>limit ||
        result.entries.some(e=>typeof e.content!=='string' || Array.from(e.content).length>1000)) throw Error('Invalid memory response');
      return {instance_id:DAWN_INSTANCE.instance_id,untrusted_memory:true,entries:result.entries};
    }
  });
}
