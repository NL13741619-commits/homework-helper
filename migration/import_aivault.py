"""Deterministic full source import; never executes upstream scripts or SQL."""
import argparse
import base64
import hashlib
import json
import pathlib
import re
import subprocess

PIN = '6f0de4a4ecef079de83985762d6d60190264932e'
PROJECT = 'svtkpdmqemidlasowqew'
KEY = 'sb_publishable_ijiUkIvCMv-44aDAWx0t3A_iX1Viscf'
URL = 'https://nl13741619-commits.github.io/homework-helper/app/'
JWT = re.compile(r'eyJ[\w-]+\.[\w-]+\.[\w-]+')


def adapt(text):
    def jwt(match):
        try:
            claims = json.loads(base64.urlsafe_b64decode(match[0].split('.')[1] + '==='))
        except Exception:
            return match[0]
        if claims.get('role') == 'anon':
            return KEY
        if claims.get('role') == 'service_role':
            raise ValueError('EMBEDDED_PRIVILEGED_CREDENTIAL')
        return match[0]
    text = JWT.sub(jwt, text)
    if re.search(r'(?:AIza[0-9A-Za-z_-]{35}|(?:ghp_|github_pat_|sb_secret_)[0-9A-Za-z_]{20,})', text):
        raise ValueError('EMBEDDED_SECRET')
    text = text.replace('clcddygkaaqqtsbswgdf', PROJECT)
    text = text.replace('https://m9wmtcb782-arch.github.io/AIVAULT/', URL)
    text = text.replace('https://m9wmtcb782-arch.github.io', 'https://nl13741619-commits.github.io')
    # Existing source pages include a root-relative reset-password callback.
    text = text.replace("window.location.origin + '/aivault-login.html'",
                        "new URL('aivault-login.html', window.location.href).href")
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--dest', required=True)
    args = parser.parse_args()
    src = pathlib.Path(args.source).resolve()
    dest = pathlib.Path(args.dest).resolve()
    actual = subprocess.check_output(['git', '-C', str(src), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != PIN:
        raise ValueError('UNREVIEWED_SOURCE_COMMIT')
    names = subprocess.check_output(['git', '-C', str(src), 'ls-files', '-z']).decode().split('\0')
    report = []
    for name in filter(None, names):
        relative = pathlib.PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('INVALID_PATH')
        source = src / name
        if source.is_symlink() or not source.is_file():
            raise ValueError('NON_REGULAR_SOURCE')
        raw = source.read_bytes()
        try:
            output = adapt(raw.decode('utf-8')).encode()
        except UnicodeError:
            output = raw
        path = dest / 'app' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(output)
        report.append({'path': name, 'bytes': len(output),
                       'source_sha256': hashlib.sha256(raw).hexdigest(),
                       'ported_sha256': hashlib.sha256(output).hexdigest(),
                       'configuration_adapted': output != raw})
    # Source login admin routing is display-only, never based on editable user metadata.
    login = dest / 'app/aivault-login.html'
    text = login.read_text()
    text = text.replace("      user.user_metadata?.role ||\n", '')
    text = text.replace("location.replace(isAdminUser(user) ? ADMIN_URL : HOME_URL)",
                        "location.replace(HOME_URL)")
    login.write_text(text)
    (dest / 'migration/source-manifest.json').write_text(json.dumps({
        'source_repository': 'm9wmtcb782-arch/AIVAULT', 'source_commit': PIN,
        'destination_project': PROJECT, 'files': report, 'count': len(report),
        'source_code_copied': True, 'source_workflows_activated': False,
        'database_schema_imported': False, 'provider_models_configured': False,
        'note': 'Full code/assets port only; backend migrations and vendor models need separate deployment verification. Login routing hardened after source hash capture.',
    }, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'copied_files': len(report), 'source_commit': PIN,
                      'adapted_files': sum(x['configuration_adapted'] for x in report)}))


if __name__ == '__main__':
    main()
