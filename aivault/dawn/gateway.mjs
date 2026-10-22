import {randomUUID} from 'node:crypto';
import {DAWN} from './profile.mjs';
const PROJECT='svtkpdmqemidlasowqew';
const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function boundedText(stream,limit) {
  if(!stream) return '';
  const reader=stream.getReader(),chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('SIZE_LIMIT');}chunks.push(value);}
  const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.byteLength;}return new TextDecoder().decode(out);
}

// Private-host handler adapter, not deployed. Authentication, quota reservation
// and fenced completion must be wired to the existing control tables by the host.
export function createDawnGateway({enabled=()=>false,modelPolicy,authorize,reserveInvocation,finishInvocation,invoke,audit,allowedOrigins=[]}) {
  return async request=>{
    const origin=request.headers.get('origin');
    const respond=(code,body)=>{
      const response=json(code,body);
      if(origin && allowedOrigins.includes(origin)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
      return response;
    };
    if(origin && !allowedOrigins.includes(origin)) return respond(403,{ok:false,status:'ORIGIN_DENIED'});
    if(request.method==='OPTIONS' && origin){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});}
    if(request.method!=='POST') return respond(405,{ok:false,status:'METHOD_DENIED'});
    const request_id=randomUUID();
    let reservation;
    try {
      if(typeof authorize!=='function') return respond(503,{ok:false,status:'BLOCKED_AUTH_NOT_WIRED'});
      const identity=await authorize(request.headers.get('authorization'));
      if(!identity?.principal || identity.project_ref!==PROJECT) return respond(401,{ok:false,status:'UNAUTHORIZED'});
      let body;try{body=JSON.parse(await boundedText(request.body,16384));}catch{return respond(400,{ok:false,status:'INVALID_INPUT'});}
      const keys=['agent_id','capability','channel_id','fencing_token','message','task_id'];
      if(!body || Array.isArray(body) || Object.keys(body).sort().join(',')!==keys.join(',') || body.agent_id!==DAWN.agent_id || body.capability!=='text' ||
        typeof body.message!=='string' || !body.message.trim() || body.message.length>4096 || typeof body.task_id!=='string' || !/^[0-9a-f-]{36}$/.test(body.task_id) ||
        typeof body.channel_id!=='string' || !/^ch-\d{4}$/.test(body.channel_id) || Number(body.channel_id.slice(3))<1 || Number(body.channel_id.slice(3))>1000 ||
        typeof body.fencing_token!=='string' || !/^[0-9]{1,19}$/.test(body.fencing_token)) return respond(400,{ok:false,status:'INVALID_INPUT'});
      if(!enabled()) return respond(503,{ok:false,status:'BLOCKED_EXECUTION_MODE',request_id});
      const policy=modelPolicy;
      if(!policy || policy.provider!=='gemini' || !/^[A-Za-z0-9._-]{1,100}$/.test(policy.model||'') || policy.approved!==true ||
        policy.billing_mode!=='free_only' || !policy.quota_evidence_id || !Number.isInteger(policy.max_output_tokens) || policy.max_output_tokens<1 || policy.max_output_tokens>256 ||
        !Number.isFinite(policy.valid_until) || policy.valid_until<=Date.now()) return respond(503,{ok:false,status:'BLOCKED_NO_MODEL',request_id});
      if(![reserveInvocation,finishInvocation,invoke,audit].every(x=>typeof x==='function')) return respond(503,{ok:false,status:'BLOCKED_CONTROL_NOT_WIRED',request_id});
      // Required durable RPC: validate caller, assigned channel/task, current live
      // lease/fence, explicit inference permission, idempotency, quota and expiry;
      // append start evidence transactionally. A dry_run task MUST be refused.
      reservation=await reserveInvocation({identity,request_id,task_id:body.task_id,channel_id:body.channel_id,fencing_token:body.fencing_token,policy});
      if(reservation?.ok!==true || !reservation.reservation_id || reservation.task_id!==body.task_id || reservation.channel_id!==body.channel_id ||
        reservation.fencing_token!==body.fencing_token || reservation.principal!==identity.principal || reservation.inference_authorized!==true ||
        reservation.task_type==='dry_run' || !Number.isFinite(reservation.lease_expires_at) || reservation.lease_expires_at<Date.now()+6000) return respond(409,{ok:false,status:'BLOCKED_TASK_OR_LEASE',request_id});
      if(!enabled()) return respond(503,{ok:false,status:'BLOCKED_EXECUTION_MODE',request_id});
      await audit({event_type:'dawn.inference_start',request_id,task_id:body.task_id,reservation_id:reservation.reservation_id,provider:policy.provider,model:policy.model,quota_evidence_id:policy.quota_evidence_id});
      const result=await invoke({policy,system:DAWN.text_prompt+'\n'+DAWN.evidence_rules,text:body.message,signal:AbortSignal.timeout(5000)});
      if(typeof result?.text!=='string' || !result.text.trim() || result.text.length>8192 || result.provider!==policy.provider || result.model!==policy.model) throw Error('INVALID_PROVIDER_RESULT');
      const committed=await finishInvocation({reservation,request_id,usage:result.usage||{},mock:result.mock===true,provider:result.provider,model:result.model});
      if(committed?.ok!==true) return respond(409,{ok:false,status:'STALE_FENCING_OR_EVIDENCE_FAILED',request_id});
      return respond(200,{ok:true,status:result.mock===true?'MOCK_TEST_ONLY':'MODEL_RESPONSE',agent_id:DAWN.agent_id,request_id,
        text:result.text,provider:result.provider,model:result.model,mock:result.mock===true,inference_executed:result.mock!==true});
    } catch {
      return respond(503,{ok:false,status:'BLOCKED_PROVIDER_OR_BACKEND',request_id});
    }
  };
}

// Approved single-provider adapter. No alternate provider, model or paid fallback.
// readSecret resolves only the SECOND BASE's existing server-side secret.
export function createGeminiTextInvoker({readSecret,secretName='GEMINI_API_KEY',fetchImpl=fetch,testMode=false}) {
  if(!['GEMINI_API_KEY','AIVAULT_GEMINI_API_KEY'].includes(secretName) || typeof readSecret!=='function') throw Error('Server secret resolver required');
  return async({policy,system,text,signal})=>{
    if(policy?.provider!=='gemini' || !/^[A-Za-z0-9._-]{1,100}$/.test(policy.model||'') || policy.approved!==true || policy.billing_mode!=='free_only') throw Error('Unapproved model');
    const key=await readSecret(secretName);if(!key) throw Error('BLOCKED_NO_MODEL');
    const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${policy.model}:generateContent`,{
      method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{maxOutputTokens:policy.max_output_tokens}})
    });
    if(!response.ok) throw Error('Provider unavailable');
    const data=JSON.parse(await boundedText(response.body,131072));
    const content=(data.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string' && !p.thought).map(p=>p.text).join('');
    if(!content) throw Error('No text result');
    return {text:content,provider:'gemini',model:policy.model,usage:data.usageMetadata||{},mock:testMode};
  };
}
