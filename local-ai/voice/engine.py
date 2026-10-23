"""Local ASR -> streamed LLM -> phrase audio. No page text is read aloud.
This is a cascaded pipeline, not an end-to-end native speech foundation model.
"""
import hashlib,json,pathlib,time,urllib.request
import numpy as np
from .protocol import PhraseBuffer

SYSTEM='你是曙光，一個溫暖、機靈的語音聊天夥伴。用繁體中文自然口語接話，像面對面聊天，不要像報告或朗讀文章。先直接回應，再視需要反問。一次一兩句，總共不超過六十字。不要Markdown、清單、表情符號或舞台動作。不要假裝做過沒有工具證據的事。/no_think'

class VoiceEngine:
    def __init__(self,root,model_url,model_key):
        from faster_whisper import WhisperModel
        from kokoro_onnx import Kokoro
        from misaki import zh
        import onnxruntime as ort
        self.root=pathlib.Path(root);self.model_url=model_url;self.model_key=model_key
        lock=json.loads((self.root/'voice-model-lock.json').read_text())
        for a in lock['assets']:
            path=self.root/a['path']
            if path.stat().st_size!=a['size_bytes'] or hashlib.file_digest(path.open('rb'),'sha256').hexdigest()!=a['sha256']:raise RuntimeError('VOICE_MODEL_HASH_MISMATCH')
        self.asr=WhisperModel(str(self.root/'asr'),device='cpu',compute_type='int8',cpu_threads=4,num_workers=1,local_files_only=True)
        options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
        session=ort.InferenceSession(str(self.root/'kokoro-v1.1-zh.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        self.tts=Kokoro.from_session(session,str(self.root/'voices-v1.1-zh.bin'),vocab_config=str(self.root/'config.json'))
        self.g2p=zh.ZHG2P(version='1.1',en_callable=lambda text:self.tts.tokenizer.phonemize(text,lang='en-us'));self.voice='zf_001'
        if self.voice not in self.tts.voices:raise RuntimeError('VOICE_NOT_AVAILABLE')
        self.lock=lock
    def warmup(self):
        # Prime ASR/TTS kernels and the immutable shared system prefix once.
        # No browser text, private conversation or external provider is used.
        from scipy.signal import resample_poly
        audio,rate=self.synthesize('你好。')
        pcm=(np.clip(resample_poly(audio,2,3),-1,1)*32767).astype('<i2').tobytes()
        self.transcribe(pcm)
        body={'model':'Qwen3-0.6B-Q8_0','stream':False,'max_tokens':1,'temperature':0,'chat_template_kwargs':{'enable_thinking':False},'messages':[{'role':'system','content':SYSTEM},{'role':'user','content':'你好。 /no_think'}]}
        request=urllib.request.Request(self.model_url+'/v1/chat/completions',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+self.model_key})
        with urllib.request.urlopen(request,timeout=35) as response:response.read(65536)
    def synthesize(self,text):
        phonemes,_=self.g2p(text)
        if not phonemes or '❓' in phonemes:raise RuntimeError('UNSUPPORTED_PRONUNCIATION')
        tokens=self.tts.tokenizer.tokenize(phonemes)
        if not tokens or len(tokens)>250:raise RuntimeError('VOICE_PHRASE_SIZE_LIMIT')
        style=np.asarray(self.tts.get_voice_style(self.voice)[len(tokens)],dtype=np.float32)
        ids=np.array([[0,*tokens,0]],dtype=np.int64)
        names={value.name:value.type for value in self.tts.sess.get_inputs()}
        # The pinned ONNX export expects float speed. kokoro-onnx 0.4.9's
        # newer-export helper sends int32; build the typed feed explicitly.
        speed_type=np.int32 if names.get('speed')=='tensor(int32)' else np.float32
        inputs={'input_ids' if 'input_ids' in names else 'tokens':ids,'style':style,'speed':np.array([1.05],dtype=speed_type)}
        audio=np.asarray(self.tts.sess.run(None,inputs)[0],dtype=np.float32).reshape(-1)
        active=np.flatnonzero(np.abs(audio)>.003)
        if not len(active):raise RuntimeError('EMPTY_VOICE_AUDIO')
        audio=audio[max(0,active[0]-720):min(len(audio),active[-1]+1920)]
        return audio,24000
    def transcribe(self,pcm):
        audio=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768
        if len(audio)<2400 or np.sqrt(np.mean(audio**2))<.005:return ''
        segments,info=self.asr.transcribe(audio,language='zh',beam_size=1,best_of=1,condition_on_previous_text=False,temperature=0,vad_filter=False,no_speech_threshold=.7,compression_ratio_threshold=2.4)
        return ''.join(s.text for s in segments if s.no_speech_prob<.7).strip()
    def respond(self,text,history,emit,stale):
        payload={'model':'Qwen3-0.6B-Q8_0','stream':True,'max_tokens':96,'temperature':.6,'chat_template_kwargs':{'enable_thinking':False},'messages':[{'role':'system','content':SYSTEM}]+history[-8:]+[{'role':'user','content':text+' /no_think'}]}
        req=urllib.request.Request(self.model_url+'/v1/chat/completions',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+self.model_key})
        buffer=PhraseBuffer();answer='';audio_seconds=0;started=time.monotonic();first_audio=None
        def speak(phrase):
            nonlocal first_audio,audio_seconds
            if stale():return
            # Voice prosody comes from the local neural speech model; UI captions
            # are optional side effects and never input to speech generation.
            synthesis_start=time.monotonic()
            audio,rate=self.synthesize(phrase)
            synthesis_seconds=time.monotonic()-synthesis_start
            if stale():return
            if first_audio is None:first_audio=time.monotonic()-started
            audio_seconds+=len(audio)/rate
            emit({'type':'audio','text':phrase,'samples':audio,'sample_rate':rate,'synthesis_seconds':round(synthesis_seconds,4)})
        with urllib.request.urlopen(req,timeout=35) as response:
            for raw in response:
                if stale():break
                if len(raw)>65536:raise RuntimeError('MODEL_STREAM_LIMIT')
                line=raw.decode().strip()
                if not line.startswith('data: '):continue
                value=line[6:]
                if value=='[DONE]':break
                data=json.loads(value);token=data.get('choices',[{}])[0].get('delta',{}).get('content','')
                if not token:continue
                answer+=token
                for phrase in buffer.add(token):speak(phrase)
                if len(answer)>160:break
        if not stale():
            for phrase in buffer.add('',final=True):speak(phrase)
        return {'text':answer,'first_audio_seconds_after_llm_start':first_audio,'audio_seconds':audio_seconds}
