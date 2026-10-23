import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PROJECT, validateCommand } from './intake.mjs';

export const channelIds = Object.freeze(Array.from({length:1000},(_,i)=>`ch-${String(i+1).padStart(4,'0')}`));
const validChannel = id => /^ch-\d{4}$/.test(id) && channelIds.includes(id);

// Private server credentials identify service principals. Database memberships
// decide actions/channels. Never accept principal_id, role, or grants from clients.
export function createChannelIntake({ credentials, rpc, enabled=()=>false, audit=event=>console.error(JSON.stringify(event)) }) {
  if(!Array.isArray(credentials) || !credentials.length || credentials.length>16000) throw Error('Server credentials required');
  const principals=new Set(), digests=new Set();
  const entries=credentials.map(({principal,token})=>{
    if(typeof principal!=='string' || !/^[A-Za-z0-9_-]{3,128}$/.test(principal) || typeof token!=='string' || token.length<32 || token.length>512 || principals.has(principal)) throw Error('Invalid or duplicate credential');
    const digest=createHash('sha256').update(token).digest();
    if(digests.has(digest.toString('hex'))) throw Error('Reused credential');
    principals.add(principal);digests.add(digest.toString('hex'));
    return {principal,digest};
  });
  // Lookup digest without a 16,000-entry scan on each request.
  const identities=new Map(entries.map(x=>[x.digest.toString('hex'),x]));
  const windows=new Map(); let active=0;
  const server=http.createServer(async(req,res)=>{
    const send=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    if(!enabled()) return send(503,{error:'KILL_SWITCH'});
    const authorization=req.headers.authorization || '';
    if(!authorization.startsWith('Bearer ') || authorization.length>519) return send(401,{error:'UNAUTHORIZED_PRINCIPAL'});
    const digest=createHash('sha256').update(authorization.slice(7)).digest();
    const identity=identities.get(digest.toString('hex'));
    if(!identity || !timingSafeEqual(identity.digest,digest)) {
      audit({event:'channel.transport_rejected',reason:'UNAUTHORIZED_PRINCIPAL'});
      return send(401,{error:'UNAUTHORIZED_PRINCIPAL'});
    }
    const route=req.url?.match(/^\/channels\/(ch-\d{4})\/(commands|claim|finish|status|dispatch|inbox|artifact_read|artifact_write)$/);
    if(req.method!=='POST' || !route || !validChannel(route[1])) return send(404,{error:'CHANNEL_ROUTE_DENIED'});
    const action=route[2]==='commands'?'intake':route[2];
    const minute=Math.floor(Date.now()/60000), previous=windows.get(identity.principal);
    const count=previous?.minute===minute?previous.count+1:1;
    windows.set(identity.principal,{minute,count});
    if(active>=8 || count>60) return send(429,{error:'RESOURCE_LIMIT'});
    active++;
    try {
      const chunks=[];let bytes=0;
      const limit=action==='artifact_write'?131072:16384;
      for await(const chunk of req) {bytes+=chunk.length;if(bytes>limit)return send(413,{error:'RESOURCE_LIMIT'});chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'MALFORMED_PAYLOAD'});}
      if(!body || Array.isArray(body) || typeof body!=='object') return send(400,{error:'MALFORMED_PAYLOAD'});
      const validation=action==='intake'?validateCommand(body):null;
      if(validation) {
        audit({event:'channel.transport_rejected',reason:validation});
        return send(400,{error:validation});
      }
      if(!enabled()) return send(503,{error:'KILL_SWITCH'});
      // Database validates command AND channel membership, then atomically
      // applies admission caps and delegates to the existing queue protocol.
      const result=await rpc(action,identity.principal,route[1],body);
      send(result.ok?200:409,result);
    } catch {send(503,{error:'BACKEND_UNAVAILABLE'});}
    finally{active--;}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;server.timeout=5000;
  server.keepAliveTimeout=1000;server.maxConnections=16;server.maxRequestsPerSocket=10;
  return server;
}

export function channelRpc({url,key,fetchImpl=fetch}) {
  if(url!==`https://${PROJECT}.supabase.co` || !key) throw Error('Second-base credential required');
  return async(action,principal,channel,body)=>{
    const method=['dispatch','inbox','artifact_read','artifact_write'].includes(action)?'aivault_collaboration':'aivault_channel';
    const response=await fetchImpl(`${url}/rest/v1/rpc/${method}`,{
      method:'POST',signal:AbortSignal.timeout(3000),
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:action,p_principal:principal,p_channel:channel,p_body:body})
    });
    if(!response.ok) throw Error('Channel RPC unavailable');
    return response.json();
  };
}
