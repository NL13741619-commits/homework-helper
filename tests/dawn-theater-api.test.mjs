import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
let handler,folder,tables,originalFetch;
class Query {
 constructor(table){this.table=table;this.filters=[];this.mode='select';this.options={};}
 select(fields,options={}){this.fields=fields;this.options=options;return this;}
 eq(k,v){this.filters.push(r=>r[k]===v);return this;}
 gte(k,v){this.filters.push(r=>r[k]>=v);return this;}
 in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}
 order(){return this;}limit(){return this;}
 maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 insert(value){this.mode='insert';this.value=value;return this;}
 upsert(value,options={}){this.mode='upsert';this.value=value;this.conflict=options.onConflict;this.ignore=options.ignoreDuplicates;return this;}
 update(value){this.mode='update';this.value=value;return this;}
 delete(){this.mode='delete';return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
  const rows=tables[this.table]||[];tables[this.table]=rows;
  let found=rows.filter(r=>this.filters.every(f=>f(r)));
  if(this.mode==='insert'){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...this.value};rows.push(row);found=[row];}
  if(this.mode==='upsert'){const keys=(this.conflict||'user_id').split(',');let row=rows.find(r=>keys.every(k=>r[k]===this.value[k]));if(row&&!this.ignore)Object.assign(row,this.value);if(!row){row={saved:false,liked:false,position_seconds:0,completed:false,watched_at:null,...this.value};rows.push(row);}found=[row];}
  if(this.mode==='update')found.forEach(r=>Object.assign(r,this.value));
  if(this.mode==='delete')tables[this.table]=rows.filter(r=>!found.includes(r));
  const count=found.length;
  let data=found.map(r=>({...r}));
  if(this.fields&&this.fields!=='*')data=data.map(r=>Object.fromEntries(this.fields.split(',').map(k=>[k,r[k]])));
  return {data:this.options.head?null:this.one?(data[0]||null):data,count,error:null};
 }).then(resolve,reject);}
}
before(async()=>{
 originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/auth\/v1\/user$/);const token=options.headers.authorization;if(![ 'Bearer '+ 'a'.repeat(40),'Bearer '+'b'.repeat(40)].includes(token))return new Response('{}',{status:401});return Response.json({id:token.includes('aaaa')?A:B,user_metadata:{full_name:'劇友'},is_anonymous:false});};
 globalThis.__theaterDb={from:table=>new Query(table)};
 globalThis.Deno={env:{get:()=>''},serve:fn=>handler=fn};
 folder=await mkdtemp(join(tmpdir(),'dawn-api-test-'));
 const source=(await readFile(new URL('../supabase/functions/dawn-theater-api/index.ts',import.meta.url),'utf8')).replace("import { createClient } from 'npm:@supabase/supabase-js@2.110.0';","const createClient = () => (globalThis as any).__theaterDb;");
 const file=join(folder,'api.ts');await writeFile(file,source);await import(pathToFileURL(file));
});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.Deno;delete globalThis.__theaterDb;await rm(folder,{recursive:true,force:true});});
beforeEach(()=>{tables={dawn_theater_state:[{user_id:B,video_id:'big-buck-bunny',position_seconds:88,liked:true,saved:true,watched_at:'2026-01-01'}]};});
const request=(body,token='a'.repeat(40))=>new Request('https://theater.test',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
test('private requests require a verified login',async()=>{assert.equal((await handler(request({action:'account'},null))).status,401);assert.equal((await handler(request({action:'account'},'x'.repeat(40)))).status,401);});
test('history returns only the verified account even if input spoofs another ID',async()=>{const response=await handler(request({action:'account',user_id:B}));assert.equal(response.status,200);assert.deepEqual((await response.json()).state,[]);});
test('progress writes are owned by verified user and do not alter other accounts',async()=>{const r=await handler(request({action:'state',position:120,user_id:B}));assert.equal(r.status,200);assert.equal(tables.dawn_theater_state.find(s=>s.user_id===B).position_seconds,88);assert.equal(tables.dawn_theater_state.find(s=>s.user_id===A).position_seconds,120);});
test('clearing history preserves collection and likes',async()=>{tables.dawn_theater_state.push({user_id:A,video_id:'big-buck-bunny',liked:true,saved:true,watched_at:'2026-01-01',position_seconds:120});await handler(request({action:'state',clearHistory:true}));const row=tables.dawn_theater_state.find(s=>s.user_id===A);assert.equal(row.watched_at,null);assert.equal(row.saved,true);assert.equal(row.liked,true);});
test('public comment response contains no account IDs or private history',async()=>{tables.dawn_theater_comments=[{id:'33333333-3333-4333-8333-333333333333',user_id:B,video_id:'big-buck-bunny',display_name:'公開名稱',body:'好看',parent_id:null}];const r=await handler(new Request('https://theater.test'));const data=await r.json();assert.equal(data.total,1);assert.equal(data.comments[0].body,'好看');assert.equal('user_id' in data.comments[0],false);assert.equal('state' in data,false);});
test('comment author is verified server-side and text stays plain data',async()=>{const r=await handler(request({action:'comment',body:'<script>alert(1)</script>',user_id:B,display_name:'偽造'}));assert.equal(r.status,201);const row=tables.dawn_theater_comments[0];assert.equal(row.user_id,A);assert.equal(row.display_name,'劇友');});
test('invalid progress and unknown reply are rejected',async()=>{assert.equal((await handler(request({action:'state',position:-2}))).status,400);assert.equal((await handler(request({action:'comment',body:'回覆',parentId:'not-a-uuid'}))).status,400);});
