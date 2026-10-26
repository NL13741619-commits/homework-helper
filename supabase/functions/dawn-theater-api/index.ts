import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
const base = Deno.env.get('SUPABASE_URL')!;
const db = createClient(base, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const mainUrl = 'https://clcddygkaaqqtsbswgdf.supabase.co';
const mainPublicKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
const videoId = 'big-buck-bunny';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checked<T>(r: {data:T; error:unknown}):T { if(r.error) throw Error('DATABASE_ERROR'); return r.data; }
Deno.serve(async req => {
 const headers = { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'https://nl13741619-commits.github.io', 'access-control-allow-headers':'authorization,apikey,content-type', 'access-control-allow-methods':'GET,POST,OPTIONS', 'vary':'Origin' };
 const send = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers});
 if(req.headers.get('origin') && req.headers.get('origin')!=='https://nl13741619-commits.github.io') return send({error:'ORIGIN_DENIED'},403);
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 try {
  if(req.method==='GET') {
   const {data:comments,error,count} = await db.from('dawn_theater_comments').select('id,video_id,user_id,display_name,body,image_url,parent_id,created_at',{count:'exact'}).eq('video_id',videoId).order('created_at',{ascending:false}).limit(100);
   if(error) throw error;
   const ids=(comments||[]).map(c=>c.id);
   const likes=ids.length?checked(await db.from('dawn_theater_comment_likes').select('comment_id').in('comment_id',ids)):[];
   const counts:Record<string,number>={}; for(const like of likes||[]) counts[like.comment_id]=(counts[like.comment_id]||0)+1;
   // Public response deliberately excludes account IDs and private viewing data.
   const publicComments=(comments||[]).map(({user_id,...comment})=>({...comment,likes:counts[comment.id]||0}));
   const saved=await db.from('dawn_theater_state').select('user_id',{count:'exact',head:true}).eq('video_id',videoId).eq('saved',true);
   const liked=await db.from('dawn_theater_state').select('user_id',{count:'exact',head:true}).eq('video_id',videoId).eq('liked',true);
   if(saved.error||liked.error)throw Error('DATABASE_ERROR');
   return send({comments:publicComments,total:count||0,saved:saved.count||0,liked:liked.count||0});
  }
  if(req.method!=='POST')return send({error:'METHOD_DENIED'},405);
  if(Number(req.headers.get('content-length')||0)>1600000)return send({error:'REQUEST_TOO_LARGE'},413);
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_.-]{32,8192}$/.test(auth))return send({error:'LOGIN_REQUIRED'},401);
  const verify=await fetch(mainUrl+'/auth/v1/user',{headers:{authorization:auth,apikey:mainPublicKey},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!verify.ok)return send({error:'LOGIN_REQUIRED'},401);
  const user=await verify.json();
  if(!uuid.test(user.id||'')||user.is_anonymous)return send({error:'LOGIN_REQUIRED'},401);
  const raw=await req.text(); if(raw.length>1500000)return send({error:'REQUEST_TOO_LARGE'},413);
  let input;try{input=JSON.parse(raw);}catch{return send({error:'INVALID_JSON'},400);}
  const uid=user.id;
  const action=input.action;
  if(action==='account') {
   const profile=checked(await db.from('dawn_theater_profiles').select('display_name,bio,preferences').eq('user_id',uid).maybeSingle());
   const state=checked(await db.from('dawn_theater_state').select('*').eq('user_id',uid));
   const likes=checked(await db.from('dawn_theater_comment_likes').select('comment_id').eq('user_id',uid));
   return send({profile,state,commentLikes:(likes||[]).map(v=>v.comment_id)});
  }
  if(action==='state') {
   const patch:Record<string,unknown>={};
   if(typeof input.saved==='boolean')patch.saved=input.saved;
   if(typeof input.liked==='boolean')patch.liked=input.liked;
   if(input.clearHistory===true){patch.watched_at=null;patch.position_seconds=0;patch.completed=false;}
   else if(typeof input.position==='number'&&Number.isFinite(input.position)&&input.position>=0&&input.position<=596.48){
    patch.position_seconds=input.position;patch.duration_seconds=596.48;patch.watched_at=new Date().toISOString();
    if(input.position>=596.48*.95)patch.completed=true;
   }
   if(!Object.keys(patch).length)return send({error:'INVALID_STATE'},400);
   checked(await db.from('dawn_theater_state').upsert({user_id:uid,video_id:videoId},{onConflict:'user_id,video_id',ignoreDuplicates:true}));
   const state=checked(await db.from('dawn_theater_state').update(patch).eq('user_id',uid).eq('video_id',videoId).select().single());
   return send({state});
  }
  if(action==='profile') {
   const preferences={genres:Array.isArray(input.genres)?input.genres.filter((v:unknown)=>typeof v==='string'&&['奇幻','喜劇','愛情','懸疑','生活','冒險'].includes(v)).slice(0,6):[]};
   const display_name=String(input.displayName||'').trim().slice(0,40);
   const bio=String(input.bio||'').trim().slice(0,160);
   const profile=checked(await db.from('dawn_theater_profiles').upsert({user_id:uid,display_name,bio,preferences,updated_at:new Date().toISOString()}).select('display_name,bio,preferences').single());
   return send({profile});
  }
  if(action==='comment') {
   const body=String(input.body||'').trim();
   if(body.length>1000||(!body&&!input.image))return send({error:'INVALID_COMMENT'},400);
   const recent=await db.from('dawn_theater_comments').select('id',{count:'exact',head:true}).eq('user_id',uid).gte('created_at',new Date(Date.now()-60000).toISOString());
   if(recent.error)throw recent.error;if((recent.count||0)>=5)return send({error:'TOO_MANY_COMMENTS'},429);
   let parent_id=null;
   if(input.parentId){if(!uuid.test(input.parentId))return send({error:'INVALID_REPLY'},400);const parent=checked(await db.from('dawn_theater_comments').select('id').eq('id',input.parentId).eq('video_id',videoId).maybeSingle());if(!parent)return send({error:'INVALID_REPLY'},400);parent_id=parent.id;}
   let image_url=null;
   if(input.image){
    const match=String(input.image).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(!match)return send({error:'INVALID_IMAGE'},400);
    let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{return send({error:'INVALID_IMAGE'},400);}
    if(bytes.length>1048576)return send({error:'IMAGE_TOO_LARGE'},413);
    const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!valid)return send({error:'INVALID_IMAGE'},400);
    const path=uid+'/'+crypto.randomUUID()+'.'+match[1];checked(await db.storage.from('dawn-theater-comments').upload(path,bytes,{contentType:'image/'+match[1],upsert:false}));
    image_url=db.storage.from('dawn-theater-comments').getPublicUrl(path).data.publicUrl;
   }
   const profile=checked(await db.from('dawn_theater_profiles').select('display_name').eq('user_id',uid).maybeSingle());
   const display_name=String(profile?.display_name||user.user_metadata?.display_name||user.user_metadata?.full_name||'劇友').slice(0,40);
   const comment=checked(await db.from('dawn_theater_comments').insert({video_id:videoId,user_id:uid,display_name,body,image_url,parent_id}).select('id,display_name,body,image_url,parent_id,created_at').single());
   return send({comment},201);
  }
  if(action==='commentLike') {
   if(!uuid.test(input.commentId||'')||typeof input.liked!=='boolean')return send({error:'INVALID_LIKE'},400);
   if(input.liked)checked(await db.from('dawn_theater_comment_likes').upsert({user_id:uid,comment_id:input.commentId},{onConflict:'user_id,comment_id',ignoreDuplicates:true}));
   else checked(await db.from('dawn_theater_comment_likes').delete().eq('user_id',uid).eq('comment_id',input.commentId));
   return send({ok:true});
  }
  if(action==='feedback') {
   const body=String(input.body||'').trim();if(body.length<1||body.length>2000)return send({error:'INVALID_FEEDBACK'},400);
   const recent=await db.from('dawn_theater_feedback').select('id',{count:'exact',head:true}).eq('user_id',uid).gte('created_at',new Date(Date.now()-3600000).toISOString());
   if(recent.error)throw recent.error;if((recent.count||0)>=5)return send({error:'TOO_MANY_REQUESTS'},429);
   checked(await db.from('dawn_theater_feedback').insert({user_id:uid,body}));return send({ok:true},201);
  }
  return send({error:'UNKNOWN_ACTION'},400);
 } catch(error) { console.error(error instanceof Error?error.message:'THEATER_ERROR');return send({error:'SERVICE_UNAVAILABLE'},503); }
});
