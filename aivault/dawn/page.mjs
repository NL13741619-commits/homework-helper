import {createDawnClient} from './client.mjs';
const state=document.getElementById('state'),answer=document.getElementById('answer'),send=document.getElementById('send');
// Existing login host must explicitly supply these callbacks after integration;
// this page does not ask for provider keys or reuse a first-base session.
const integration=globalThis.AIVAULT_DAWN_INTEGRATION;
let client;
try{
  if(integration?.enabled===true){client=createDawnClient(integration);send.disabled=false;state.textContent='登入與任務權限將由第二基地後端驗證。';}
}catch{state.textContent='第二基地介面設定尚未完成。';}
send.addEventListener('click',async()=>{
  if(!client)return;
  send.disabled=true;answer.textContent='等待後端回覆…';
  try{const result=await client.text(document.getElementById('message').value);answer.textContent=result.ok?result.text:result.status;state.textContent=result.mock?'隔離測試回應，未執行真實推論。':result.status;}
  catch{answer.textContent='服務尚未連通或請求失敗。';}
  finally{send.disabled=false;}
});
