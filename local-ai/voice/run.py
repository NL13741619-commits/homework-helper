"""Single-command localhost voice host with owned local model lifecycle."""
import argparse,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from run import launch,shutdown
from server import private_key
from voice.engine import VoiceEngine
from voice.server import make_app
from aiohttp import web

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--model-root',required=True);parser.add_argument('--voice-root',required=True);parser.add_argument('--port',type=int,default=18181);parser.add_argument('--model-port',type=int,default=18081);args=parser.parse_args()
    if args.port==args.model_port or not all(1024<=p<=65535 for p in [args.port,args.model_port]):raise ValueError('INVALID_PORT')
    token_path=pathlib.Path(args.model_root).resolve()/'dawn-voice-ui-token';token=private_key(token_path)
    proc,model,lock,log=launch(args.model_root,args.model_port)
    try:
        engine=VoiceEngine(args.voice_root,model.url,model.key)
        # Prime only neural synthesis, not a provider request or fabricated reply.
        engine.warmup()
        print(f'Local Dawn voice: http://127.0.0.1:{args.port}\nPrivate access-code file: {token_path}\nChinese voice ready; browser microphone/speaker must be tested on your device.',flush=True)
        web.run_app(make_app(engine,token),host='127.0.0.1',port=args.port,print=None)
    finally:shutdown(proc,log)
if __name__=='__main__':main()
