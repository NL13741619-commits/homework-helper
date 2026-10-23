const KEY = "sb_publishable_ijiUkIvCMv-44aDAWx0t3A_iX1Viscf";
const ORIGIN = "https://nl13741619-commits.github.io";
Deno.serve((req: Request) => {
 const origin=req.headers.get("origin");
 const headers: Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
 if(origin===ORIGIN){headers["Access-Control-Allow-Origin"]=ORIGIN;headers["Access-Control-Allow-Headers"]="apikey,content-type";headers["Access-Control-Allow-Methods"]="GET,OPTIONS";}
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!==ORIGIN)return respond(403,{error:"ORIGIN_DENIED"});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="GET")return respond(405,{error:"READ_ONLY_CATALOG"});
 if(req.headers.get("apikey")!==KEY)return respond(401,{error:"APIKEY_REQUIRED"});
 const present=Boolean(Deno.env.get("MAGIC_HOUR_API_KEY")?.trim());
 const allowed=(Deno.env.get("PAID_API_ALLOW")||"").split(",").map(s=>s.trim());
 const videoAuthorized=Deno.env.get("PAID_API_KILL")!=="1"&&allowed.includes("magic_hour_video");
 return respond(200,{base:"base-002",project:"svtkpdmqemidlasowqew",inference_executed:false,
  models:[
   {id:"dawn-qwen",kind:"text",status:"VERIFIED_ISSUE_TRIGGERED",model:"Qwen3-0.6B-Q8_0",persistent_http:false},
   {id:"digital-human-renderer",kind:"avatar-renderer",status:"ASSETS_COPIED",model:null,generative_model:false},
   {id:"digital-human-generative",kind:"talking-photo",provider:"magic_hour",key_configured:present,status:"NOT_CONNECTED",inference_verified:false},
   {id:"short-video-generative",kind:"text-image-to-video",provider:"magic_hour",key_configured:present,video_authorized:videoAuthorized,status:!present?"BLOCKED_NO_PROVIDER_KEY":!videoAuthorized?"BLOCKED_PROVIDER_AUTHORIZATION":"REQUIRES_GENERATION_TEST",inference_verified:false}
  ],note:"Read-only capability catalog. A key or copied source does not prove working inference."});
});