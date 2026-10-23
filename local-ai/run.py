"""Start the hash-verified local model and Dawn UI together; stop both on exit."""
import argparse,importlib.util,pathlib,subprocess,time,threading
from server import LocalModel,State,handler,ThreadingHTTPServer,private_key
ROOT=pathlib.Path(__file__).resolve().parents[1]
def launch(model_root,model_port):
    root=pathlib.Path(model_root).resolve();key_path=root/'dawn-model-key';key=private_key(key_path)
    spec=importlib.util.spec_from_file_location('qwen_host',ROOT/'aivault/dawn/qwen-host.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    command,_,lock=module.setup(argparse.Namespace(root=str(root),key_file=str(key_path),port=model_port))
    log=(root/'dawn-model.log').open('w');proc=subprocess.Popen(command,stdout=log,stderr=log)
    model=LocalModel(model_port,key);deadline=time.monotonic()+60
    while not model.health():
        if proc.poll() is not None or time.monotonic()>deadline:
            proc.terminate();proc.wait(timeout=5);log.close();raise RuntimeError('MODEL_STARTUP_FAILED_SEE_PRIVATE_LOG')
        time.sleep(.2)
    return proc,model,lock,log

def shutdown(proc,log):
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
    log.close()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--model-root',required=True);parser.add_argument('--port',type=int,default=18180);parser.add_argument('--model-port',type=int,default=18081);args=parser.parse_args()
    if args.port==args.model_port or not all(1024<=p<=65535 for p in [args.port,args.model_port]):raise ValueError('INVALID_PORT')
    root=pathlib.Path(args.model_root).resolve();token_file=root/'dawn-ui-token';token=private_key(token_file)
    proc,model,lock,log=launch(root,args.model_port)
    try:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),handler(State(token,model)));server.daemon_threads=True
        print(f'Dawn local AI: http://127.0.0.1:{args.port}\nAccess code file: {token_file}\nModel loaded and hash checked. This terminal must remain running. No external AI API.',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
    finally:shutdown(proc,log)
if __name__=='__main__':main()
