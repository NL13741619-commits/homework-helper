import {protect} from "../_shared/media-auth.mjs";
import {paidAllowed,PAID_DENIED} from "../_shared/paid_gate.ts";
const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"https://nl13741619-commits.github.io","Vary":"Origin"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(protect(async (req:Request)=>{
 if(!paidAllowed("magic_hour_talking_photo"))return json(403,{error:PAID_DENIED,inference_executed:false});
 const key=Deno.env.get("MAGIC_HOUR_API_KEY")?.trim();
 if(!key)return json(503,{error:"MISSING_MAGIC_HOUR_API_KEY",inference_executed:false});
 const body=await req.json();
 let id=String(body.id||"");
 const auth={Authorization:"Bearer "+key,"Content-Type":"application/json"};
 let created=false;
 if(!id){
  const image=String(body.image_file_path||""),audio=String(body.audio_file_path||"");
  const valid=(x:string)=>/^[A-Za-z0-9][A-Za-z0-9_./-]{1,499}$/.test(x)&&!x.includes("..");
  if(!valid(image)||!valid(audio))return json(400,{error:"UPLOADED_PROVIDER_IMAGE_AND_AUDIO_REQUIRED",inference_executed:false});
  const response=await fetch("https://api.magichour.ai/v1/ai-talking-photo",{method:"POST",headers:auth,redirect:"error",signal:AbortSignal.timeout(25000),body:JSON.stringify({name:"Second-base digital human",assets:{image_file_path:image,audio_file_path:audio},start_seconds:0,end_seconds:5})});
  const result=await response.json();
  if(!response.ok||!result.id)return json(502,{error:"PROVIDER_CREATE_REJECTED",upstream_status:response.status,inference_verified:false});
  id=String(result.id);created=true;
 }
 if(!/^[A-Za-z0-9_-]{5,100}$/.test(id))return json(400,{error:"INVALID_JOB_ID"});
 const response=await fetch("https://api.magichour.ai/v1/video-projects/"+encodeURIComponent(id),{headers:auth,redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!response.ok)return json(502,{error:"PROVIDER_STATUS_UNAVAILABLE",job_id:id,created});
 const result=await response.json();
 const downloads=Array.isArray(result.downloads)?result.downloads:[];
 const urls=downloads.map((x:unknown)=>typeof x==="string"?x:(x as {url?:string})?.url).filter((x:unknown)=>typeof x==="string"&&x.startsWith("https://"));
 const complete=["complete","completed"].includes(String(result.status).toLowerCase())&&urls.length>0;
 return json(complete?200:202,{job_id:id,created,status:result.status||"PROCESSING",provider:"magic_hour",duration_seconds:5,video_url:complete?urls[0]:null,inference_verified:complete});
}));
