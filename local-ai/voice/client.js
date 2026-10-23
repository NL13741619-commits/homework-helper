'use strict';
const $=id=>document.getElementById(id);
const labels={listening:'我在聽，你可以直接說。',recognizing:'正在聽懂這句話…',thinking:'曙光正在接話…',speaking:'曙光正在說話，你隨時可以插話。'};
let ctx=null,stream=null,source=null,mic=null,silent=null,ws=null,analyser=null,nodes=new Set(),nextTime=0,epoch=0,run=0,ready=false,raf=0;
function state(value,text){$('sun').dataset.state=value;$('status').textContent=text||labels[value]||value;}
function caption(who,text){if(!$('captions').checked)return;const line=document.createElement('p');line.textContent=who+'：'+text;$('transcript').append(line);$('transcript').scrollTop=$('transcript').scrollHeight;}
function control(data){if(ws?.readyState===1)ws.send(JSON.stringify(data));}
function clearAudio(){for(const node of nodes){try{node.onended=null;node.stop();node.disconnect();}catch{}}nodes.clear();nextTime=ctx?.currentTime||0;control({type:'playback',active:false});$('sun').style.transform='';}
function animate(){cancelAnimationFrame(raf);const values=new Float32Array(512);function tick(){if(!ctx||!analyser)return;analyser.getFloatTimeDomainData(values);let sum=0;for(const v of values)sum+=v*v;const level=Math.sqrt(sum/values.length);$('sun').style.transform=nodes.size?'scale('+(1+Math.min(.17,level*1.5))+')':'';raf=requestAnimationFrame(tick);}tick();}
function play(message){
 if(!ctx||message.epoch!==epoch)return;
 const raw=atob(message.pcm),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length%2)return;
 const view=new DataView(bytes.buffer),float=new Float32Array(bytes.length/2);for(let i=0;i<float.length;i++)float[i]=view.getInt16(i*2,true)/32768;
 const buffer=ctx.createBuffer(1,float.length,message.sample_rate);buffer.copyToChannel(float,0);
 const node=ctx.createBufferSource();node.buffer=buffer;node.connect(analyser);const when=Math.max(ctx.currentTime+.03,nextTime);node.start(when);nextTime=when+buffer.duration;nodes.add(node);
 control({type:'playback',active:true});state('speaking');caption('曙光',message.text);
 node.onended=()=>{nodes.delete(node);node.disconnect();if(!nodes.size){control({type:'playback',active:false});state('listening');}};
}
async function stop(text='語音已結束。'){
 run++;ready=false;cancelAnimationFrame(raf);clearAudio();control({type:'stop'});const socket=ws;ws=null;if(socket){socket.onclose=null;socket.onerror=null;socket.close();}
 try{source?.disconnect();mic?.disconnect();silent?.disconnect();}catch{}source=mic=silent=null;
 stream?.getTracks().forEach(track=>track.stop());stream=null;const audio=ctx;ctx=null;analyser=null;if(audio)await audio.close().catch(()=>{});
 $('start').disabled=false;$('stop').disabled=true;$('interrupt').disabled=true;state('offline',text);
}
$('start').onclick=async()=>{
 if(ctx)return;const attempt=++run;$('start').disabled=true;$('stop').disabled=false;state('connecting','正在準備麥克風與本地語音模型…');
 try{
  const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC();await ctx.resume();
  const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  if(attempt!==run){media.getTracks().forEach(t=>t.stop());return;}stream=media;
  await ctx.audioWorklet.addModule('/mic-worklet.js');if(attempt!==run)return;
  analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.connect(ctx.destination);
  const url=new URL('/voice',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(url);ws.binaryType='arraybuffer';
  const socket=ws;const deadline=setTimeout(()=>{if(attempt===run&&!ready)stop('語音主機連線逾時。');},10000);
  socket.onopen=()=>control({type:'auth',token:$('token').value.trim()});
  socket.onmessage=async event=>{
   if(attempt!==run)return;
   try{
    const message=JSON.parse(event.data);
    if(message.type==='ready'){
     clearTimeout(deadline);ready=true;epoch=message.epoch;source=ctx.createMediaStreamSource(stream);mic=new AudioWorkletNode(ctx,'dawn-microphone');silent=ctx.createGain();silent.gain.value=0;
     source.connect(mic);mic.connect(silent);silent.connect(ctx.destination);
     mic.port.onmessage=e=>{if(ready&&socket.readyState===1){if(socket.bufferedAmount>64000){stop('上傳延遲過高，已停止收音。');return;}socket.send(e.data);}};
     $('interrupt').disabled=false;state('listening');animate();return;
    }
    if(message.type==='interrupt'){epoch=message.epoch;clearAudio();state('listening');return;}
    if(message.epoch!==undefined&&message.epoch!==epoch)return;
    if(message.type==='audio'){play(message);return;}
    if(message.type==='state'){state(message.state);return;}
    if(message.type==='input_transcript'){caption('你',message.text);return;}
    if(message.type==='error'){clearAudio();state('error','語音尚未完成：'+(message.code||'UNKNOWN'));return;}
    if(message.type==='generation_done'&&!nodes.size)state('listening');
   }catch{await stop('收到無法處理的語音資料，已停止收音。');}
  };
  socket.onclose=e=>{clearTimeout(deadline);if(attempt===run)stop('語音連線已中斷（'+e.code+'），麥克風已關閉。');};
  socket.onerror=()=>{clearTimeout(deadline);if(attempt===run)stop('無法連上本地語音主機，請確認模型與存取碼。');};
 }catch(e){if(attempt===run)await stop(e.name==='NotAllowedError'?'請允許麥克風權限後再開始。':'無法開始語音：'+e.message);}
};
$('interrupt').onclick=()=>{clearAudio();control({type:'interrupt'});state('listening');};
$('stop').onclick=()=>stop();$('captions').onchange=()=>{$('transcript').hidden=!$('captions').checked;if(!$('captions').checked)$('transcript').replaceChildren();};
window.addEventListener('pagehide',()=>stop());
