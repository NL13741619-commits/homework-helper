import {protect} from '../_shared/media-auth.mjs';
import {readiness, identity, setupMessage, inputMessage, VOICES} from './protocol.mjs';
const env=(name:string)=>Deno.env.get(name);
const headers={'Access-Control-Allow-Origin':'https://nl13741619-commits.github.io','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
async function config(){
  const key=env('GEMINI_API_KEY')||env('AIVAULT_GEMINI_API_KEY');
  const r=await fetch(env('SUPABASE_URL')+'/rest/v1/ai_agent_runtime_config?select=enabled,model_policy&instance_id=eq.base-002%3Adawn-light',{headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY')!,Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY')},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('CONFIG_UNAVAILABLE');
  const [row]=await r.json(),policy=row?.model_policy||{};
  const ready=row?.enabled?readiness(policy,!!key):{chat:false,live:false,error:'SERVICE_DISABLED'};
  return {key,policy,ready};
}
const post=protect(async(req:Request)=>{
  const raw=await req.text();if(raw.length>50000)return json({error:'REQUEST_TOO_LARGE'},413);
  let b;try{b=JSON.parse(raw);}catch{return json({error:'INVALID_REQUEST'},400);}
  const {key,policy,ready}=await config();
  if(b.action==='health')return json({...ready,voices:VOICES,checked_at:new Date().toISOString(),inference_executed:false});
  if(b.action!=='chat'||typeof b.message!=='string'||!b.message.trim()||b.message.length>7000)return json({error:'INVALID_REQUEST'},400);
  let system;try{system=identity(b.agent_id);}catch{return json({error:'INVALID_AGENT'},400);}
  if(!ready.chat)return json({error:ready.error,inference_executed:false},409);
  const history=Array.isArray(b.history)?b.history.slice(-12).filter((x:any)=>['user','model'].includes(x.role)&&typeof x.text==='string'&&x.text.length<=7000).map((x:any)=>({role:x.role,parts:[{text:x.text}]})):[];
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+policy.model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key!},body:JSON.stringify({systemInstruction:{parts:[{text:system+' 使用繁體中文。不得捏造工具執行、記憶、來源或部署結果。'}]},contents:[...history,{role:'user',parts:[{text:b.message}]}],generationConfig:{maxOutputTokens:2048}}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)return json({error:'GEMINI_HTTP_'+r.status,inference_executed:false},502);
  const data=await r.json(),text=(data.candidates?.[0]?.content?.parts||[]).filter((p:any)=>!p.thought&&typeof p.text==='string').map((p:any)=>p.text).join('');
  return text.trim()?json({content:text,model:policy.model,agent_id:b.agent_id,inference_executed:true}):json({error:'EMPTY_MODEL_REPLY'},502);
});
Deno.serve(async(req:Request)=>{
  if(req.headers.get('upgrade')?.toLowerCase()!=='websocket')return post(req);
  // Browsers cannot attach Authorization headers to a WebSocket upgrade.
  // Validate the common first-base login with the same owner/admin check as POST.
  const u=new URL(req.url),token=u.searchParams.get('access_token')||'';
  const h=new Headers(req.headers);h.set('authorization','Bearer '+token);
  const authorized=protect(async()=>{
    const {key,policy,ready}=await config();
    if(!ready.live)return json({error:ready.error},409);
    let setup;try{setup=setupMessage(policy.live_model,u.searchParams.get('agent_id')||'dawn-light',u.searchParams.get('voice')||'Aoede');}catch{return json({error:'INVALID_LIVE_CONFIG'},400);}
    const {socket,response}=Deno.upgradeWebSocket(req,{idleTimeout:60});
    let upstream:WebSocket|null=null,initialized=false,closed=false,bytes=0,lastVideo=0;
    let finish!:()=>void;const lifetime=new Promise<void>(r=>finish=r);
    // Keep the Edge worker alive after the upgrade response.
    EdgeRuntime.waitUntil(lifetime);
    const send=(v:unknown)=>{if(socket.readyState===1)socket.send(JSON.stringify(v));};
    const cleanup=()=>{if(closed)return;closed=true;clearTimeout(timer);try{upstream?.close();}catch{}try{socket.close(1000,'session ended');}catch{}finish();};
    const fail=(code:string)=>{send({type:'error',error:{message:code}});cleanup();};
    const timer=setTimeout(()=>fail('SESSION_LIMIT_RECONNECT_MANUALLY'),120000);
    socket.onopen=()=>{
      upstream=new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key='+encodeURIComponent(key!));
      upstream.onopen=()=>upstream!.send(JSON.stringify(setup));
      upstream.onmessage=async e=>{try{const text=typeof e.data==='string'?e.data:await e.data.text();const m=JSON.parse(text);if(m.setupComplete){initialized=true;send({type:'ready',agent_id:u.searchParams.get('agent_id')||'dawn-light'});}if(m.error){fail('GEMINI_SETUP_FAILED');return;}send(m);}catch{fail('INVALID_UPSTREAM_MESSAGE');}};
      upstream.onerror=()=>fail('GEMINI_CONNECTION_FAILED');
      upstream.onclose=()=>{if(!closed)fail('GEMINI_DISCONNECTED');};
    };
    socket.onmessage=e=>{try{
      if(typeof e.data!=='string'||e.data.length>360000)throw Error('INVALID_LIVE_INPUT');
      bytes+=e.data.length;if(bytes>16000000)throw Error('SESSION_INPUT_LIMIT');
      if(!initialized)throw Error('SESSION_NOT_READY');
      const m=JSON.parse(e.data);if(m.type==='video'){if(Date.now()-lastVideo<950)return;lastVideo=Date.now();}
      upstream!.send(JSON.stringify(inputMessage(m,u.searchParams.get('video')==='1')));
    }catch(e){fail(e instanceof Error?e.message:'INVALID_LIVE_INPUT');}};
    socket.onclose=cleanup;socket.onerror=cleanup;
    return response;
  });
  return authorized(new Request(req.url,{method:'POST',headers:h}));
});
