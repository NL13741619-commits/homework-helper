import {VOICES} from '../supabase/functions/dawn-city-ai/protocol.mjs';
const $=id=>document.getElementById(id),ENDPOINT='https://svtkpdmqemidlasowqew.supabase.co/functions/v1/dawn-city-ai';
const errors={GEMINI_KEY_MISSING:'第二基地尚未設定 Gemini 金鑰，請由管理員在後端設定。',MODEL_NOT_CONFIGURED:'曙光模型尚未指定或啟用，現在無法產生 AI 回覆。',MODEL_POLICY_NOT_READY:'曙光模型的免費配額／使用設定尚未完成。',LIVE_MODEL_NOT_CONFIGURED:'Gemini 即時語音模型尚未設定或啟用；一般文字模型不能取代 Live 模型。',SERVICE_DISABLED:'曙光 AI 服務已停用。',LOGIN_REQUIRED:'請先登入。',INVALID_SESSION:'登入已失效，請重新登入。',OWNER_ROLE_REQUIRED:'目前帳號尚未取得曙光 AI 使用權限。',AUTH_UNAVAILABLE:'登入驗證服務暫時無法連線。',GEMINI_CONNECTION_FAILED:'Gemini 即時服務連線失敗，請檢查後端金鑰、模型與配額。',GEMINI_SETUP_FAILED:'Gemini 拒絕即時模型或語音設定，請檢查後端設定。',GEMINI_DISCONNECTED:'Gemini 連線已中斷，請重新連線。',SESSION_LIMIT_RECONNECT_MANUALLY:'本次即時對話已達時間上限，請再次點選即時語音或視訊。'};
let agent='dawn-light',health=null,busy=false,active=false,starting=false,epoch=0,ws=null,stream=null,ctx=null,source=null,processor=null,sink=null,timer=0,facing='user',nextAudio=0,sources=[],liveRows={},session=null,records=[];
const orbs={
 'dawn-light':window.DarkStarOrb.mount($('dawnOrb'),{size:110,theme:'dawn'}),
 'technical-dark-star':window.DarkStarOrb.mount($('darkOrb'),{size:65})
};
const name=()=>agent==='dawn-light'?'曙光':'暗星';
function status(text,state='waiting'){$('status').textContent=text;$('status').dataset.state=state;}
function explain(code){return errors[code]||(/HTTP_404/.test(code)?'曙光城 AI 後端尚未部署。':/^HTTP_/.test(code)?'曙光城服務錯誤：'+code:'連線未完成：'+code);}
async function token(){const client=await window.AIVAULT_AUTH_READY;if(!client)throw Error('LOGIN_REQUIRED');const {data,error}=await client.auth.getSession();if(error||!data.session?.access_token)throw Error('LOGIN_REQUIRED');return data.session.access_token;}
async function api(body){const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await token()},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'?data.error:'HTTP_'+r.status);return data;}
async function check(){health=null;status('正在檢查曙光城 AI 服務…');try{health=await api({action:'health'});status(health.chat?(health.live?'文字模型已設定；即時語音／視訊可嘗試連線。':'文字模型已設定。'+explain(health.error)):explain(health.error));}catch(e){status(explain(e.message));}}
const storageKey=()=> 'dawn-city-chat-v1:'+window.AIVAULT_USER.id;
function persist(){try{localStorage.setItem(storageKey(),JSON.stringify(records.slice(-40)));}catch{status('裝置儲存空間不足，這次對話可能無法保存。');}renderHistory();}
function row(role,text,who=agent){const d=document.createElement('div');d.className='message '+(role==='user'?'user':'');const b=document.createElement('b');b.textContent=role==='user'?'你':who==='dawn-light'?'☀️ 曙光':'暗星';const t=document.createElement('span');t.textContent=text;d.append(b,t);$('messages').append(d);d.scrollIntoView({block:'nearest'});return t;}
function save(role,text){if(!text.trim())return;session.turns.push({role,text,agent_id:agent});persist();}
function newChat(){session={id:crypto.randomUUID(),agent_id:agent,created_at:Date.now(),turns:[]};records.unshift(session);$('messages').replaceChildren();persist();}
function renderHistory(){$('history').replaceChildren();for(const item of records){const b=document.createElement('button');b.className='history-row';b.textContent=(item.agent_id==='dawn-light'?'☀️ ':'🌑 ')+new Date(item.created_at).toLocaleString('zh-TW')+' '+(item.turns[0]?.text||'新聊天').slice(0,25);b.onclick=async()=>{if(busy)return;await stop();agent=item.agent_id;session=item;syncAgent();$('messages').replaceChildren();item.turns.forEach(t=>row(t.role,t.text,t.agent_id));};$('history').append(b);}}
function syncAgent(){$('chooseDawn').setAttribute('aria-pressed',String(agent==='dawn-light'));$('chooseDark').setAttribute('aria-pressed',String(agent==='technical-dark-star'));$('input').placeholder='傳訊息給'+name()+'…';}
async function choose(id){if(agent===id||busy)return;await stop();agent=id;syncAgent();newChat();}
$('chooseDawn').onclick=()=>choose('dawn-light');$('chooseDark').onclick=()=>choose('technical-dark-star');
for(const [id,key,defaultVoice] of [['dawnVoice','dawnLightVoice','Aoede'],['darkVoice','darkStarVoice','Kore']]){for(const voice of VOICES){const o=document.createElement('option');o.value=voice;o.textContent=voice;$(id).append(o);}let saved;try{saved=localStorage.getItem(key);}catch{}$(id).value=VOICES.includes(saved)?saved:defaultVoice;$(id).onchange=()=>{try{localStorage.setItem(key,$(id).value);}catch{}if(active)status('聲音已保存，請結束後重新連線套用。');};}
function clearPlayback(){sources.forEach(s=>{try{s.stop();}catch{}});sources=[];nextAudio=0;orbs[agent].setTalking(0);}
function play(data){if(!ctx)return;const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const pcm=new DataView(bytes.buffer),f=new Float32Array(Math.floor(bytes.length/2));for(let i=0;i<f.length;i++)f[i]=pcm.getInt16(i*2,true)/32768;const b=ctx.createBuffer(1,f.length,24000);b.copyToChannel(f,0);const s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);sources.push(s);const when=Math.max(ctx.currentTime,nextAudio);s.start(when);nextAudio=when+b.duration;orbs[agent].setTalking(.5);s.onended=()=>{sources=sources.filter(x=>x!==s);if(!sources.length)orbs[agent].setTalking(0);};}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);}
function pcm16(input,rate){const size=Math.floor(input.length*16000/rate),out=new Uint8Array(size*2),view=new DataView(out.buffer);for(let i=0;i<size;i++){const a=Math.floor(i*rate/16000),b=Math.min(input.length,Math.floor((i+1)*rate/16000));let sum=0;for(let j=a;j<b;j++)sum+=input[j];const v=Math.max(-1,Math.min(1,sum/Math.max(1,b-a)));view.setInt16(i*2,v<0?v*32768:v*32767,true);}return out;}
function flushLive(){for(const [role,r] of Object.entries(liveRows)){save(role,r.textContent);}liveRows={};}
async function stop(show=true){epoch++;active=false;starting=false;clearInterval(timer);timer=0;const socket=ws;ws=null;if(socket){socket.onclose=null;socket.onerror=null;try{socket.close();}catch{}}try{processor?.disconnect();source?.disconnect();sink?.disconnect();}catch{}processor=source=sink=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;$('camera').hidden=true;clearPlayback();const audio=ctx;ctx=null;if(audio)await audio.close().catch(()=>{});flushLive();$('stop').disabled=true;$('switchCamera').disabled=true;$('voice').disabled=false;$('video').disabled=false;if(show)status('即時連線已結束。');}
async function start(video){
 if(active||starting||busy)return;starting=true;const attempt=++epoch;const AC=window.AudioContext||window.webkitAudioContext;
 try{
  // Create and resume during the iPhone tap, before awaiting auth/network.
  ctx=new AC();await ctx.resume();if(attempt!==epoch)return;$('stop').disabled=false;$('voice').disabled=true;$('video').disabled=true;status('正在檢查 Gemini 即時服務…');
  const current=await api({action:'health'});if(attempt!==epoch)return;if(!current.live)throw Error(current.error||'LIVE_MODEL_NOT_CONFIGURED');
  const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:video?{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480}}:false});
  if(attempt!==epoch){media.getTracks().forEach(t=>t.stop());return;}stream=media;
  if(video){$('camera').srcObject=media;$('camera').hidden=false;await $('camera').play();}
  const auth=await token();if(attempt!==epoch)return;
  const u=new URL(ENDPOINT);u.protocol='wss:';u.search=new URLSearchParams({access_token:auth,agent_id:agent,voice:$(agent==='dawn-light'?'dawnVoice':'darkVoice').value,video:video?'1':'0'}).toString();
  const socket=new WebSocket(u);ws=socket;
  const timeout=setTimeout(()=>{if(attempt===epoch){stop(false);status('Gemini 連線逾時，請重新連線。');}},20000);
  socket.onmessage=async event=>{if(attempt!==epoch)return;try{const m=JSON.parse(typeof event.data==='string'?event.data:await event.data.text());if(m.type==='error'){clearTimeout(timeout);await stop(false);status(explain(m.error.message));return;}if(m.type==='ready'){
   clearTimeout(timeout);active=true;starting=false;status(name()+' Gemini 即時'+(video?'視訊':'語音')+'已連線，正在聆聽。','ready');
   source=ctx.createMediaStreamSource(stream);processor=ctx.createScriptProcessor(2048,1,1);sink=ctx.createGain();sink.gain.value=0;source.connect(processor);processor.connect(sink);sink.connect(ctx.destination);
   processor.onaudioprocess=e=>{if(active&&ws?.readyState===1&&ws.bufferedAmount<1000000)ws.send(JSON.stringify({type:'audio',data:b64(pcm16(e.inputBuffer.getChannelData(0),e.inputBuffer.sampleRate))}));};
   if(video){$('switchCamera').disabled=false;const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;timer=setInterval(()=>{if(!active||ws?.readyState!==1||!$('camera').videoWidth||ws.bufferedAmount>1000000)return;canvas.getContext('2d').drawImage($('camera'),0,0,480,360);ws.send(JSON.stringify({type:'video',data:canvas.toDataURL('image/jpeg',.6).split(',')[1]}));},1100);}
  }
  const c=m.serverContent||{};if(c.interrupted)clearPlayback();for(const [role,text] of [['user',c.inputTranscription?.text],['model',c.outputTranscription?.text]]){if(text){if(!liveRows[role])liveRows[role]=row(role,'');liveRows[role].textContent+=text;}}
  for(const p of c.modelTurn?.parts||[]){if(p.inlineData?.mimeType?.startsWith('audio/pcm'))play(p.inlineData.data);}if(c.turnComplete)flushLive();
  }catch{clearTimeout(timeout);await stop(false);status('收到無法處理的 Gemini 即時回覆。');}};
  socket.onclose=async e=>{clearTimeout(timeout);if(attempt!==epoch)return;await stop(false);status('即時連線中斷（'+e.code+'）。請檢查模型、登入與配額後重試。');};
  socket.onerror=async()=>{clearTimeout(timeout);if(attempt!==epoch)return;await stop(false);status('即時連線失敗：請確認 dawn-city-ai 已部署並允許 WebSocket，且 Gemini Live 模型已設定。');};
 }catch(e){if(attempt!==epoch)return;await stop(false);status(e.name==='NotAllowedError'?'請允許麥克風／相機權限，再重新連線。':explain(e.message));}
}
$('switchCamera').onclick=async()=>{if(!active||!stream)return;const attempt=epoch;facing=facing==='user'?'environment':'user';try{const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing}}});if(attempt!==epoch){media.getTracks().forEach(t=>t.stop());return;}stream.getVideoTracks().forEach(t=>{stream.removeTrack(t);t.stop();});media.getVideoTracks().forEach(t=>stream.addTrack(t));$('camera').srcObject=stream;await $('camera').play();}catch{status('無法切換相機，請確認相機權限。');}};
$('composer').onsubmit=async e=>{e.preventDefault();const text=$('input').value.trim();if(!text||busy||starting)return;if(active){if(ws?.readyState!==1)return;ws.send(JSON.stringify({type:'text',text}));row('user',text);save('user',text);$('input').value='';return;}busy=true;$('send').disabled=true;$('chooseDawn').disabled=$('chooseDark').disabled=true;$('input').value='';const history=session.turns.slice(-12).map(t=>({role:t.role,text:t.text}));row('user',text);save('user',text);status(name()+'正在思考…');try{const result=await api({action:'chat',agent_id:agent,message:text,history});if(!result.inference_executed||!result.content)throw Error('EMPTY_MODEL_REPLY');row('model',result.content);save('model',result.content);orbs[agent].setExpression('happy',2000);status(name()+'已回覆 · '+result.model,'ready');}catch(error){status(explain(error.message));}finally{busy=false;$('send').disabled=false;$('chooseDawn').disabled=$('chooseDark').disabled=false;}};
$('voice').onclick=()=>start(false);$('video').onclick=()=>start(true);$('stop').onclick=()=>stop();$('newChat').onclick=async()=>{if(busy)return;await stop();newChat();};$('retryHealth').onclick=check;
window.addEventListener('pagehide',()=>stop(false));
await window.AIVAULT_AUTH_READY;
if(window.AIVAULT_USER){try{const raw=JSON.parse(localStorage.getItem(storageKey())||'[]');records=Array.isArray(raw)?raw.filter(x=>x&&Array.isArray(x.turns)&&['dawn-light','technical-dark-star'].includes(x.agent_id)):[];}catch{}newChat();check();}
