import {protect} from './media-auth.mjs';
import {createRuntime} from './runtime.mjs';
const env = n=>Deno.env.get(n);
const runtime=createRuntime({env});
const names=['曙光・首席','曙光・工程','曙光・審核','曙光・策略','曙光・創作','曙光・協調'];
const headers={'Access-Control-Allow-Origin':'https://nl13741619-commits.github.io','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function read(path){
 const key=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('STATUS_UNAVAILABLE');return r.json();
}
Deno.serve(protect(async req=>{
 let body;try{const text=await req.text();if(text.length>14000)return json({error:'REQUEST_TOO_LARGE'},413);body=JSON.parse(text);}catch{return json({error:'INVALID_REQUEST'},400);}
 if(body.action==='health'){
  const rows=await read('ai_agent_runtime_config?select=enabled,model_policy&instance_id=eq.base-002%3Adawn-light');
  const p=rows[0]?.model_policy||{};
  const credential=p.provider==='gemini'?!!(env('GEMINI_API_KEY')||env('AIVAULT_GEMINI_API_KEY')):p.provider==='qwen_self_hosted'?!!(env('AIVAULT_QWEN_API_KEY')||env('QWEN_ACCESS_TOKEN')):false;
  const ready=rows[0]?.enabled===true&&p.approved===true&&p.billing_mode==='free_only'&&p.context_transfer_authorized===true&&!!p.model&&!!p.quota_evidence_id&&!!p.license_evidence_id&&Date.parse(p.valid_until)>Date.now()&&credential;
  const recent=await read('ai_agent_runs?select=status,evidence,finished_at&runner_id=eq.dawn-runtime&order=finished_at.desc.nullslast&limit=100');
  return json({ok:true,checked_at:new Date().toISOString(),inference_executed:false,agents:names.map((name,i)=>{
   const id='a'+(i+1),run=recent.find(r=>r.evidence?.agent_id===id);
   const verified=ready&&run?.status==='succeeded'&&run.evidence?.inference_executed===true&&Date.now()-Date.parse(run.finished_at)<900000;
   return {id,name,ready,verified,last_inference_at:run?.finished_at||null,status_text:!rows[0]?.enabled?'大腦服務已停用':!p.model?'網關已接通・模型待設定':!ready?'網關已接通・模型待啟用':verified?'推理已驗證・'+new Date(run.finished_at).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'}):'模型已設定・待推理驗證'};
  })});
 }
 if(body.action!=='chat'||!/^a[1-6]$/.test(body.agent_id)||typeof body.userMessage!=='string'||!body.userMessage.trim()||body.userMessage.length>7000)return json({error:'INVALID_REQUEST'},400);
 const result=await runtime.brain(body.agent_id,names[Number(body.agent_id.slice(1))-1],body.userMessage);
 if(result.status!=='succeeded'||!result.evidence?.inference_executed)return json({error:result.evidence?.error||result.error||'MODEL_NOT_AVAILABLE',task_id:result.task_id},409);
 return json({content:result.evidence.answer,model:result.evidence.model,inference_executed:true,task_id:result.task_id});
}));
