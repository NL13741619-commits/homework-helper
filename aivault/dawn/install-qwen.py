"""Download verified official CPU runtime and Qwen weights to an explicit host cache.
No pip, paid API, git model blobs, public listener or automatic service install.
"""
import pathlib, urllib.request, hashlib, tarfile, argparse, json, platform, shutil

LOCK = {
    'model_repo': 'Qwen/Qwen3-0.6B-GGUF',
    'model_revision': '23749fefcc72300e3a2ad315e1317431b06b590a',
    'model_filename': 'Qwen3-0.6B-Q8_0.gguf',
    'model_size': 639446688,
    'model_sha256': '9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031',
    'license': 'Apache-2.0',
    'runtime_repo': 'ggml-org/llama.cpp',
    'runtime_tag': 'b11669',
    'runtime_commit': '620d2225cc436ab0b001e3200e590e3b286ef9ab',
    'runtime_asset': 'llama-b11669-bin-ubuntu-x64.tar.gz',
    'runtime_size': 17851611,
    'runtime_sha256': 'cf07c1c112d709bd67e522017471de57ed0ec8bea031d732c5422351c07f65ac'
}

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def obtain(url, path, size, expected):
    if path.exists() and path.stat().st_size == size and digest(path) == expected:
        return
    temporary = path.with_suffix(path.suffix + '.part')
    request = urllib.request.Request(url, headers={'User-Agent': 'AIVAULT-reviewed-Qwen-installer'})
    with urllib.request.urlopen(request, timeout=30) as response, temporary.open('wb') as file:
        total = 0
        while True:
            chunk = response.read(1024*1024)
            if not chunk:
                break
            total += len(chunk)
            if total > size:
                raise RuntimeError('Download exceeds pinned size')
            file.write(chunk)
    if temporary.stat().st_size != size or digest(temporary) != expected:
        raise RuntimeError('Download size or SHA256 mismatch')
    temporary.replace(path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    if platform.system() != 'Linux' or platform.machine() != 'x86_64':
        raise RuntimeError('Pinned binary supports Linux x86_64 only')
    root = pathlib.Path(args.root).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if shutil.disk_usage(root).free < 2*1024**3:
        raise RuntimeError('At least 2 GiB free disk required for this installation')
    archive = root / LOCK['runtime_asset']
    obtain(f"https://github.com/{LOCK['runtime_repo']}/releases/download/{LOCK['runtime_tag']}/{LOCK['runtime_asset']}", archive, LOCK['runtime_size'], LOCK['runtime_sha256'])
    binary_root = root / 'runtime'
    binary_root.mkdir(mode=0o700, exist_ok=True)
    with tarfile.open(archive) as tar:
        tar.extractall(binary_root, filter='data')
    obtain(f"https://huggingface.co/{LOCK['model_repo']}/resolve/{LOCK['model_revision']}/{LOCK['model_filename']}", root / LOCK['model_filename'], LOCK['model_size'], LOCK['model_sha256'])
    (root / 'verified-lock.json').write_text(json.dumps(LOCK, indent=2)+'\n')
    print(json.dumps({'status': 'DOWNLOADED_HASH_VERIFIED', 'lock': LOCK, 'inference_executed': False}))
