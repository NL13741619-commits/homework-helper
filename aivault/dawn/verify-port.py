"""Verify pinned source and target bytes; no keys, model calls or source writes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--local-review-dir', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
assert manifest['repository'] == 'm9wmtcb782-arch/AIVAULT'
assert re.fullmatch(r'[0-9a-f]{40}', manifest['commit'])
verified = []
for source in manifest['sources']:
    if source['status'] != 'downloaded_read_only':
        continue
    relative = Path(source['path'])
    assert not relative.is_absolute() and '..' not in relative.parts
    if args.local_review_dir:
        data = (args.local_review_dir / relative).read_bytes()
    else:
        url = ('https://raw.githubusercontent.com/m9wmtcb782-arch/AIVAULT/'
               + manifest['commit'] + '/' + relative.as_posix())
        data = urllib.request.urlopen(url, timeout=20).read()
    assert hashlib.sha256(data).hexdigest() == source['sha256'], relative
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == source['git_blob_sha'], relative
    verified.append(relative.as_posix())
for target in manifest['target_files']:
    candidate = (root / target['path']).resolve()
    assert root in candidate.parents
    assert hashlib.sha256(candidate.read_bytes()).hexdigest() == target['sha256'], candidate.name
print(json.dumps({'source_commit': manifest['commit'], 'sources_verified': len(verified),
                  'target_files_verified': len(manifest['target_files']),
                  'model_inference_executed': False, 'status': 'HASH_VERIFICATION_PASS'}, indent=2))
