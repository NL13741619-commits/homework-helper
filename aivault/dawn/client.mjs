import {DAWN} from './profile.mjs';
export const DAWN_GATEWAY='https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-dawn-text';
export function createDawnClient({getSession,getTaskContext,gateway=DAWN_GATEWAY,fetchImpl=fetch}) {
  if(gateway!==DAWN_GATEWAY || typeof getSession!=='function' || typeof getTaskContext!=='function') throw Error('Second-base login/task integration required');
  return {
    agent_id:DAWN.agent_id,
    async text(message) {
      if(typeof message!=='string' || !message.trim() || message.length>4096) return {ok:false,status:'INVALID_INPUT'};
      const session=await getSession();
      if(!session?.access_token) return {ok:false,status:'LOGIN_REQUIRED'};
      const task=await getTaskContext();
      if(!task?.task_id || !task?.channel_id || !task?.fencing_token) return {ok:false,status:'TASK_CONTEXT_REQUIRED'};
      const response=await fetchImpl(gateway,{method:'POST',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(7000),
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({agent_id:DAWN.agent_id,capability:'text',message:message.trim(),task_id:task.task_id,channel_id:task.channel_id,fencing_token:String(task.fencing_token)})});
      const body=await response.json();
      return {...body,ok:response.ok && body.ok===true};
    }
  };
}
