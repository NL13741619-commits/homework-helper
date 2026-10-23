"""Live private endpoint check. Token stays in an external 0600 file, never output."""
import os, pathlib, urllib.request, urllib.error, json, uuid, datetime, hashlib

URL = 'https://svtkpdmqemidlasowqew.supabase.co/functions/v1/aivault-dawn-runtime'
token = pathlib.Path(os.environ['AIVAULT_DAWN_TOKEN_FILE']).read_text().strip()
test_id = 'dawn_live_' + uuid.uuid4().hex

def call(body, auth=True, extra=None):
    headers = {'Content-Type': 'application/json', **(extra or {})}
    if auth:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=65) as response:
            return {'http': response.status, 'body': json.load(response)}
    except urllib.error.HTTPError as error:
        return {'http': error.code, 'body': json.loads(error.read())}

report = {'test_id': test_id, 'time_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'trigger': 'engineering-controller', 'executor': 'deployed base-002:dawn-light bounded runtime'}
report['unauthenticated'] = call({'action': 'status'}, False)
assert report['unauthenticated']['http'] == 401
report['origin_denied'] = call({'action': 'status'}, extra={'Origin': 'https://unapproved.invalid'})
assert report['origin_denied']['http'] == 403
report['status_before'] = call({'action': 'status'})
assert report['status_before']['body']['ok']
report['tasks'] = []
for kind, question in [('memory_status', ''), ('hash_text', '曙光 literal $(touch /tmp/never-execute)'), ('qa', '17+25等於多少？請只回答數字。')]:
    command = {'action': 'submit', 'kind': kind, 'question': question, 'idempotency_key': test_id + '_' + kind}
    submitted = call(command)
    assert submitted['http'] == 200 and submitted['body']['ok'], submitted
    duplicate = call(command)
    assert duplicate['body'].get('duplicate') is True
    changed = call({**command, 'question': question + 'changed'})
    assert changed['http'] == 409 and changed['body']['error'] == 'IDEMPOTENCY_CONFLICT'
    task_id = submitted['body']['task_id']
    execution = call({'action': 'run_once', 'task_id': task_id, 'poll': False})
    assert execution['http'] == 200, execution
    result = call({'action': 'result', 'task_id': task_id})
    record = {'kind': kind, 'submission': submitted, 'duplicate': duplicate, 'conflict': changed, 'execution': execution, 'persisted_result': result}
    report['tasks'].append(record)
    persisted = result['body']['result']
    if kind != 'qa':
        assert persisted['status'] == 'succeeded', persisted
        assert execution['body']['task']['evidence']['inference_executed'] is False
    if kind == 'hash_text':
        assert execution['body']['task']['evidence']['result']['sha256'] == hashlib.sha256(question.encode()).hexdigest()
for extra in [{'branch': 'main'}, {'model': 'paid-model'}, {'repository': 'NL13741619-commits/safe-reunion'}]:
    rejected = call({'action': 'submit', 'kind': 'hash_text', 'question': 'x', 'idempotency_key': test_id + '_denied', **extra})
    assert rejected['http'] == 400
report['status_after'] = call({'action': 'status'})
report['tools_live_verified'] = True
report['qa_inference_verified'] = report['tasks'][2]['execution']['body']['task']['evidence']['inference_executed']
report['scheduler_verification_separate'] = True
print(json.dumps(report, ensure_ascii=False, indent=2))
