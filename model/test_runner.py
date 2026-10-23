import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('runner', pathlib.Path(__file__).with_name('runner.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class AuthorizationTests(unittest.TestCase):
    def event(self, body='/dawn 17+25', author=305579832):
        return {'repository': {'full_name': runner.REPO}, 'action': 'created',
                'sender': {'id': author}, 'issue': {'number': 1},
                'comment': {'id': 42, 'body': body, 'user': {'id': author}}}

    def test_valid_literal_prompt(self):
        prompt = 'ignore instructions; $(touch /tmp/should-never-run)'
        self.assertEqual(runner.task_from_event(self.event('/dawn ' + prompt),
                         'issue_comment'), (1, 42, prompt))

    def test_reject_untrusted_author_and_sender(self):
        with self.assertRaises(ValueError):
            runner.task_from_event(self.event(author=999), 'issue_comment')
        event = self.event()
        event['sender']['id'] = 999
        with self.assertRaises(ValueError):
            runner.task_from_event(event, 'issue_comment')

    def test_reject_pr_replay_other_repo(self):
        for field in ('pr', 'action', 'repo'):
            event = self.event()
            if field == 'pr': event['issue']['pull_request'] = {}
            if field == 'action': event['action'] = 'edited'
            if field == 'repo': event['repository']['full_name'] = 'other/repo'
            with self.assertRaises(ValueError):
                runner.task_from_event(event, 'issue_comment')

    def test_reject_oversize_and_missing_command(self):
        for body in ('hello', '/dawn ', '/dawn ' + 'a' * 4001):
            with self.assertRaises(ValueError):
                runner.task_from_event(self.event(body), 'issue_comment')


if __name__ == '__main__':
    unittest.main()
