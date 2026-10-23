"""Real finite local E2E; saves WAV/MIDI and evidence, never secrets."""
import argparse,base64,hashlib,json,pathlib,sys,time,threading,urllib.request,urllib.error,uuid,socket,resource
import numpy as np
import pyworld
from scipy.io import wavfile
from run import launch,shutdown
from server import State,handler,ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--model-root',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
    out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    proc,model,lock,log=launch(args.model_root,port)
    server=ThreadingHTTPServer(('127.0.0.1',0),handler(State('b'*40,model)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}'
    def post(route,body):
        body['request_id']=str(uuid.uuid4());r=urllib.request.Request(url+route,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+'b'*40})
        with urllib.request.urlopen(r,timeout=90) as response:return json.load(response)
    try:
        results=[]
        for question in ['17加25是多少？再說一句你是誰。','我今天很累，請用一句繁體中文鼓勵我。']:
            result=post('/chat',{'message':question,'history':[]});results.append({'question':question,**result})
        score=json.loads((ROOT/'original-score.json').read_text());song=post('/sing',{'score':score})
        stems={'vocal_wav':'dawn-vocal.wav','backing_wav':'dawn-backing.wav','mix_wav':'dawn-song.wav','midi':'dawn-melody.mid'}
        artifacts=[]
        for key,name in stems.items():
            raw=base64.b64decode(song.pop(key));(out/name).write_bytes(raw);artifacts.append({'filename':name,'size_bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
        (out/'dawn-timeline.json').write_text(json.dumps(song,indent=2))
        rate,pcm=wavfile.read(out/'dawn-vocal.wav');x=np.ascontiguousarray(pcm.astype(float)/32768)
        f0,t=pyworld.harvest(x,rate,f0_floor=80,f0_ceil=850)
        measurements=[]
        for note in song['timeline']:
            values=f0[(t>note['start_seconds']+.1)&(t<note['end_seconds']-.1)];values=values[values>0]
            hz=float(np.median(values)) if len(values) else None
            measurements.append({'lyric':note['lyric'],'midi':note['midi'],'target_hz':note['target_hz'],'measured_hz':hz,'absolute_cents_error':float(abs(1200*np.log2(hz/note['target_hz']))) if hz else None})
        evidence={'model_downloaded':True,'model_loaded':True,'inference_pass':all(r['inference_executed'] for r in results),'arithmetic_pass':'42' in results[0]['text'],'text_http_end_to_end_pass':True,'cloud_end_to_end_pass':False,'persistent_host':False,'external_ai_api_calls':0,'model_lock':lock,'chat':results,'singing':song,'pitch_measurements':measurements,'artifacts':artifacts,'peak_child_rss_kib':None,'memory_measurement_note':'Not collected; no model RAM claim','trained_singing_model':False,'asr':'NOT_IMPLEMENTED','chinese_voice':'NOT_IMPLEMENTED','listening_quality_review':'NOT_PERFORMED'}
        (out/'benchmark.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2));print(json.dumps(evidence,ensure_ascii=False,indent=2))
    finally:server.shutdown();server.server_close();shutdown(proc,log)
if __name__=='__main__':main()
