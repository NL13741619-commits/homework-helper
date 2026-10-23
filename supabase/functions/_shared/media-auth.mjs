export function protect(handler, {env = n => Deno.env.get(n), fetchImpl = fetch} = {}) {
 return async req => {
  const origin=req.headers.get("origin");
  const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"https://nl13741619-commits.github.io","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
  const fail=(status,error)=>new Response(JSON.stringify({error,inference_executed:false}),{status,headers});
  if(origin&&origin!=="https://nl13741619-commits.github.io")return fail(403,"ORIGIN_DENIED");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return fail(405,"METHOD_DENIED");
  const auth=req.headers.get("authorization")||"";
  if(!/^Bearer [A-Za-z0-9_.-]{32,8192}$/.test(auth))return fail(401,"LOGIN_REQUIRED");
  let response,user;
  try {
   response=await fetchImpl("https://svtkpdmqemidlasowqew.supabase.co/auth/v1/user",{headers:{Authorization:auth,apikey:env("SUPABASE_ANON_KEY")||""},redirect:"error",signal:AbortSignal.timeout(8000)});
   if(!response.ok)return fail(401,"INVALID_SESSION");
   user=await response.json();
  }catch{return fail(503,"AUTH_UNAVAILABLE");}
  if(!user.id||!["owner","admin"].includes(user.app_metadata?.role))return fail(403,"OWNER_ROLE_REQUIRED");
  try{return await handler(req);}catch{return fail(502,"GENERATION_REQUEST_FAILED_NO_AUTOMATIC_RETRY");}
 };
}
