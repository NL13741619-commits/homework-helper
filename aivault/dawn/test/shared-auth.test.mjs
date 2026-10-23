import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../../shared-auth.js',import.meta.url),'utf8').replace("import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm')",'loadSdk()');
async function run(result){
 const redirects=[];const classes=new Set();const handlers={};
 const document={currentScript:{src:'https://base.test/homework-helper/shared-auth.js'},documentElement:{style:{visibility:'hidden'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
 const client={auth:{getUser:async()=>{if(result instanceof Error)throw result;return result;},onAuthStateChange:fn=>handlers.auth=fn}};
 const context={URL,document,location:{pathname:'/homework-helper/dawn.html',search:'?test=1',replace:x=>redirects.push(x)},loadSdk:async()=>({createClient:()=>client}),AIVAULT_AUTH_CONFIG:{url:'https://main.test',key:'public'},addEventListener:(n,f)=>handlers[n]=f};
 context.window=context;vm.runInNewContext(source,context);
 const value=await context.AIVAULT_AUTH_READY;return {value,redirects,classes,document,handlers};
}
for(const [label,result] of [['missing',{data:{user:null}}],['expired',{error:{message:'expired'},data:{user:null}}],['anonymous',{data:{user:{id:'anon',is_anonymous:true}}}],['network failure',new Error('offline')]]){
 test(label+' must return to login and keep page hidden',async()=>{
  const r=await run(result);assert.equal(r.value,null);assert.equal(r.document.documentElement.style.visibility,'hidden');assert.equal(r.redirects.length,1);
  const u=new URL(r.redirects[0]);assert.equal(u.pathname,'/homework-helper/index.html');assert.equal(u.searchParams.get('next'),'/homework-helper/dawn.html?test=1');
 });
}
test('server-verified member enters; signout locks page immediately',async()=>{
 const r=await run({data:{user:{id:'verified'}}});assert.ok(r.value);assert.equal(r.redirects.length,0);assert.ok(r.classes.has('av-authed'));assert.equal(r.document.documentElement.style.visibility,'');
 r.handlers.auth('SIGNED_OUT',null);assert.equal(r.redirects.length,1);assert.equal(r.document.documentElement.style.visibility,'hidden');
});
