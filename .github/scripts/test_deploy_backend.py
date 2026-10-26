import io
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from deploy_backend import Deployment, check_database_from_runner, classify_database_error, deployable


class DeployTests(unittest.TestCase):
    def test_secret_and_runtime_files_are_never_uploaded(self):
        for name in ['backend/.env', 'backend/.env.production', 'backend/.env.example',
                     'backend/.venv/lib.py', 'backend/logs/server.log', 'backend/site.sqlite',
                     'backend/tests/test_auth.py', 'frontend/package.json']:
            with self.subTest(name=name):
                self.assertFalse(deployable(Path(name)))
        self.assertTrue(deployable(Path('backend/app.py')))
        self.assertTrue(deployable(Path('backend/migrations/versions/0005_user_storage.py')))

    def test_error_diagnostics_do_not_echo_credentials(self):
        message = classify_database_error(Exception('password authentication failed: secret@example.com'))
        self.assertEqual(message, 'database credentials were rejected')
        self.assertNotIn('secret', message)
        self.assertFalse(check_database_from_runner('')[0])
        self.assertFalse(check_database_from_runner('postgresql://u:secret@example.com:6543/postgres')[0])

    @patch('deploy_backend.time.sleep')
    def test_upload_retry_rewinds_content(self, sleep):
        deploy = Deployment.__new__(Deployment)
        deploy.api_base = 'https://api.example'
        deploy.session = Mock()
        data = io.BytesIO(b'backend content')
        reads = []
        def respond(*args, **kwargs):
            reads.append(kwargs['files']['content'].read())
            return Mock(status_code=429 if len(reads) == 1 else 201, ok=len(reads) > 1, headers={'Retry-After':'1'})
        deploy.session.request.side_effect = respond
        deploy.api('POST', '/upload', files={'content':data})
        self.assertEqual(reads, [b'backend content', b'backend content'])

    @patch('deploy_backend.requests.get')
    def test_demo_or_unavailable_database_is_not_a_successful_deploy(self, get):
        deploy = Deployment.__new__(Deployment)
        deploy.domain = 'app.example'
        get.side_effect = [Mock(status_code=200,json=lambda:{'success':True,'authMode':'demo'}),
                           Mock(status_code=200,json=lambda:{'success':True,'database':'disabled_demo'}),
                           Mock(status_code=200,json=lambda:{'success':True})]
        self.assertEqual(len(deploy.health()),2)

    def test_bad_database_preflight_prevents_upload_and_reload(self):
        deploy = Deployment.__new__(Deployment)
        deploy.server_configuration = Mock(return_value=(False,'credentials were rejected'))
        deploy.upload = Mock()
        deploy.api = Mock()
        with self.assertRaisesRegex(RuntimeError,'No files were deployed'):
            deploy.run()
        deploy.upload.assert_not_called()
        deploy.api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
