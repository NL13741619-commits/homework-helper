"""Dawn private localhost chat/speech/singing host. No remote provider fallback."""
import argparse, base64, hashlib, hmac, json, os, secrets, threading, time, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from audio_engine import speech, wav_bytes, sing

MODEL='Qwen3-0.6B-Q8_0'
SYSTEM='你是曙光，第二基地的小太陽 AI。用繁體中文自然聊天。沒有工具證據不得宣稱已施工或部署。不會的內容請坦白說明。/no_think'
ROOT=Path(__file__).resolve().parent

class LocalModel:
    def __init__(self,port,key):self.url=f'http://127.0.0.1:{port}';self.key=key
    def request(self,path,body=None):
        req=urllib.request.Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+self.key})
        with urllib.request.urlopen(req,timeout=60) as response:
            raw=response.read(131073)
            if len(raw)>131072:raise RuntimeError('MODEL_RESPONSE_TOO_LARGE')
            return json.loads(raw)
    def health(self):
        try:return self.request('/health').get('status')=='ok'
        except Exception:return False
    def chat(self,message,history):
        result=self.request('/v1/chat/completions',{'model':MODEL,'messages':[{'role':'system','content':SYSTEM}]+history+[{'role':'user','content':message+' /no_think'}], 'max_tokens':256,'temperature':.5,'stream':False,'chat_template_kwargs':{'enable_thinking':False}})
        text=result.get('choices',[{}])[0].get('message',{}).get('content','')
        if not isinstance(text,str) or not text.strip():raise RuntimeError('EMPTY_MODEL_REPLY')
        return {'text':text,'model':result.get('model',MODEL),'provider_request_id':result.get('id'),'usage':result.get('usage'),'inference_executed':True}

def private_key(path):
    path=Path(path)
    if not path.exists():
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as file:file.write(secrets.token_urlsafe(32))
    if path.is_symlink() or path.stat().st_mode & 0o077:raise RuntimeError('KEY_FILE_MUST_BE_PRIVATE')
    key=path.read_text().strip()
    if len(key)<32:raise RuntimeError('KEY_TOO_SHORT')
    return key

class State:
    def __init__(self,token,model):
        self.token=token;self.model=model;self.lock=threading.Lock();self.slots=threading.BoundedSemaphore(2);self.calls=[];self.jobs={}
    def reserve(self,request_id):
        with self.lock:
            now=time.time();self.calls=[t for t in self.calls if now-t<86400]
            if request_id in self.jobs:raise ValueError('DUPLICATE_REQUEST')
            if len(self.calls)>=200 or sum(now-t<60 for t in self.calls)>=20:raise ValueError('LOCAL_QUOTA_EXCEEDED')
            if len(self.jobs)>500: self.jobs={k:v for k,v in self.jobs.items() if now-v['created']<3600}
            if not self.slots.acquire(blocking=False):raise ValueError('HOST_BUSY')
            self.calls.append(now);job={'cancel':threading.Event(),'created':now};self.jobs[request_id]=job
            return job

def handler(state):
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.0'
        def log_message(self,*_):pass
        def send(self,status,body,kind='application/json'):
            data=body if isinstance(body,bytes) else json.dumps(body,ensure_ascii=False).encode()
            self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'");self.end_headers()
            try:self.wfile.write(data)
            except (BrokenPipeError,ConnectionResetError):pass
        def host_ok(self):
            allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
            origin=self.headers.get('Origin')
            return self.headers.get('Host') in allowed and (not origin or origin in {'http://'+h for h in allowed})
        def do_GET(self):
            if not self.host_ok():return self.send(403,{'error':'ORIGIN_DENIED'})
            if self.path=='/health':return self.send(200,{'model':MODEL,'chat':state.model.health(),'tts':'LOCAL_ENGLISH_ONLY','singing':'EXPERIMENTAL_DSP','asr':'NOT_IMPLEMENTED','external_api':False,'persistent_host':False})
            paths={'/':('index.html','text/html; charset=utf-8'),'/client.js':('client.js','text/javascript'),'/style.css':('style.css','text/css')}
            if self.path not in paths:return self.send(404,{'error':'NOT_FOUND'})
            path,kind=paths[self.path];return self.send(200,(ROOT/path).read_bytes(),kind)
        def do_POST(self):
            if not self.host_ok():return self.send(403,{'error':'ORIGIN_DENIED'})
            if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+state.token):return self.send(401,{'error':'UNAUTHORIZED'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=32768:return self.send(413,{'error':'BODY_LIMIT'})
                body=json.loads(self.rfile.read(length));request_id=body.get('request_id','')
                uuid.UUID(request_id)
                if not isinstance(body,dict):raise ValueError('INVALID_INPUT')
            except Exception:return self.send(400,{'error':'INVALID_INPUT'})
            if self.path=='/cancel':
                with state.lock:
                    job=state.jobs.get(request_id)
                    if job:job['cancel'].set()
                return self.send(200,{'cancel_requested':bool(job),'request_id':request_id})
            if self.path not in ['/chat','/speak','/sing']:return self.send(404,{'error':'NOT_FOUND'})
            try:job=state.reserve(request_id)
            except ValueError as error:return self.send(429,{'error':str(error),'request_id':request_id})
            started=time.monotonic();code=200
            try:
                if self.path=='/chat':
                    text=body.get('message');history=body.get('history',[])
                    if not isinstance(text,str) or not text.strip() or len(text)>4000 or not isinstance(history,list) or len(history)>12:raise ValueError('INVALID_CHAT')
                    if any(not isinstance(t,dict) or t.get('role') not in ['user','assistant'] or not isinstance(t.get('content'),str) or len(t['content'])>4000 for t in history):raise ValueError('INVALID_HISTORY')
                    result=state.model.chat(text,[{'role':t['role'],'content':t['content']} for t in history])
                elif self.path=='/speak':
                    audio,rate=speech(body.get('text'));result={'wav':base64.b64encode(wav_bytes(audio,rate)).decode(),'voice_id':'flite-slt-en','engine':'local-flite','neural_tts':False}
                else:
                    song=sing(body.get('score'),cancelled=job['cancel'].is_set)
                    result={k:base64.b64encode(v).decode() if isinstance(v,bytes) else v for k,v in song.items()}
                if job['cancel'].is_set():raise ValueError('CANCELLED')
                result.update(request_id=request_id,latency_seconds=round(time.monotonic()-started,4));self.send(200,result)
            except ValueError as error:
                code=400;self.send(code,{'error':str(error),'request_id':request_id})
            except Exception:
                code=503;self.send(code,{'error':'LOCAL_ENGINE_UNAVAILABLE','request_id':request_id})
            finally:
                state.slots.release()
                print(json.dumps({'request_id':request_id,'route':self.path,'status':code,'latency_seconds':round(time.monotonic()-started,4)}),flush=True)
    return Handler

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=18180);parser.add_argument('--model-port',type=int,default=18081);parser.add_argument('--token-file',required=True);parser.add_argument('--model-key-file',required=True);args=parser.parse_args()
    if not all(1024<=p<=65535 for p in [args.port,args.model_port]):raise ValueError('INVALID_PORT')
    state=State(private_key(args.token_file),LocalModel(args.model_port,private_key(args.model_key_file)))
    server=ThreadingHTTPServer(('127.0.0.1',args.port),handler(state));server.daemon_threads=True
    print(f'Dawn local host: http://127.0.0.1:{args.port} — enter the token from your private token file; no external AI API',flush=True)
    server.serve_forever()
if __name__=='__main__':main()
