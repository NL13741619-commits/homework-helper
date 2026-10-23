export const VOICES = ['Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];
export function readiness(policy={}, hasKey=false, now=Date.now()) {
  if (!hasKey) return {chat:false,live:false,error:'GEMINI_KEY_MISSING'};
  if (policy.provider!=='gemini'||!policy.model||policy.approved!==true) return {chat:false,live:false,error:'MODEL_NOT_CONFIGURED'};
  if (policy.billing_mode!=='free_only'||!policy.quota_evidence_id||!policy.license_evidence_id||policy.context_transfer_authorized!==true||!(Date.parse(policy.valid_until)>now)) return {chat:false,live:false,error:'MODEL_POLICY_NOT_READY'};
  const valid = s=>/^[A-Za-z0-9._-]{1,100}$/.test(s||'');
  const chat=valid(policy.model),live=chat&&valid(policy.live_model)&&policy.live_approved===true&&!!policy.live_quota_evidence_id;
  return {chat,live,error:!chat?'MODEL_NOT_CONFIGURED':!live?'LIVE_MODEL_NOT_CONFIGURED':null};
}
export function identity(agent) {
  if (!['dawn-light','technical-dark-star'].includes(agent)) throw Error('INVALID_AGENT');
  return agent==='dawn-light'?'你是曙光 Dawn Light，AIVAULT 第二基地曙光城的 AI 助理，以曙光為主體。你不是暗星。':'你是暗星 Technical Dark Star，在 AIVAULT 第二基地協助曙光。你不是曙光。';
}
export function setupMessage(model,agent,voice) {
  if(!VOICES.includes(voice))throw Error('INVALID_VOICE');
  return {setup:{model:'models/'+model,generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}},systemInstruction:{parts:[{text:identity(agent)+'使用繁體中文自然對話。僅依實際收到的聲音與畫面回答；沒有工具執行證據不得宣稱已施工、已部署或讀取主城記憶。'}]},inputAudioTranscription:{},outputAudioTranscription:{}}};
}
export function inputMessage(m,videoAllowed) {
  if(m.type==='text'&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=7000)return {realtimeInput:{text:m.text}};
  if(m.type==='audio'&&typeof m.data==='string'&&m.data.length<=64000&&/^[A-Za-z0-9+/]+=*$/.test(m.data))return {realtimeInput:{audio:{data:m.data,mimeType:'audio/pcm;rate=16000'}}};
  if(m.type==='video'&&videoAllowed&&typeof m.data==='string'&&m.data.length<=350000&&/^[A-Za-z0-9+/]+=*$/.test(m.data))return {realtimeInput:{video:{data:m.data,mimeType:'image/jpeg'}}};
  throw Error('INVALID_LIVE_INPUT');
}
