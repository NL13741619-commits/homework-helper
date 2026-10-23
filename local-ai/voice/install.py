"""Download only reviewed, pinned local voice weights. Does not start a service."""
import argparse,hashlib,json,pathlib,shutil,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent

def install(destination):
    root=pathlib.Path(destination).resolve();root.mkdir(parents=True,exist_ok=True)
    lock=json.loads((ROOT/'model-lock.json').read_text())
    if shutil.disk_usage(root).free<1500*1024**2:raise RuntimeError('AT_LEAST_1_5_GIB_FREE_REQUIRED')
    for asset in lock['assets']:
        relative=pathlib.PurePosixPath(asset['path'])
        if relative.is_absolute() or '..' in relative.parts:raise RuntimeError('INVALID_ASSET_PATH')
        path=root/relative;path.parent.mkdir(parents=True,exist_ok=True)
        def valid(file):return file.exists() and file.stat().st_size==asset['size_bytes'] and hashlib.file_digest(file.open('rb'),'sha256').hexdigest()==asset['sha256']
        if not valid(path):
            part=path.with_name(path.name+'.part')
            req=urllib.request.Request(asset['url'],headers={'User-Agent':'DawnReviewedVoiceInstaller/0.1'})
            with urllib.request.urlopen(req,timeout=45) as response,part.open('wb') as file:
                total=0
                while data:=response.read(1048576):
                    total+=len(data)
                    if total>asset['size_bytes']:raise RuntimeError('ASSET_SIZE_LIMIT')
                    file.write(data)
            if not valid(part):part.unlink(missing_ok=True);raise RuntimeError('VOICE_MODEL_HASH_MISMATCH')
            part.replace(path)
        print(json.dumps({'asset':asset['path'],'status':'HASH_VERIFIED','bytes':asset['size_bytes']}),flush=True)
    (root/'voice-model-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);args=parser.parse_args();install(args.root)
