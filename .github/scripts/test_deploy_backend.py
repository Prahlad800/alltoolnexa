import io
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from deploy_backend import Deployment, check_database_from_runner, classify_database_error, deployable, update_environment
from dotenv import dotenv_values


class DeployTests(unittest.TestCase):
    def test_transport_configuration_preserves_other_environment_settings(self):
        existing="JWT_SECRET_KEY='unchanged'\nDATABASE_TRANSPORT=postgres\n"
        result=update_environment(existing,{'DATABASE_TRANSPORT':'supabase','SUPABASE_SECRET_KEY':"secret\\value'quote"})
        parsed=dotenv_values(stream=io.StringIO(result),interpolate=False)
        self.assertEqual(parsed['JWT_SECRET_KEY'],'unchanged')
        self.assertEqual(parsed['DATABASE_TRANSPORT'],'supabase')
        self.assertEqual(parsed['SUPABASE_SECRET_KEY'],"secret\\value'quote")
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

    @patch('deploy_backend.requests.get')
    def test_healthy_old_revision_or_wrong_transport_cannot_pass_deployment(self,get):
        deploy = Deployment.__new__(Deployment)
        deploy.domain = 'app.example'
        deploy.revision = 'a'*40
        deploy.expected_transport = 'supabase-https'
        for revision,transport,count in [('b'*40,'supabase-https',1),('a'*40,'postgres',1),('a'*40,'supabase-https',0)]:
            with self.subTest(revision=revision,transport=transport):
                get.side_effect = [Mock(status_code=200,json=lambda:{'success':True,'authMode':'database','revision':revision}),
                                   Mock(status_code=200,json=lambda:{'success':True,'database':'connected','transport':transport}),
                                   Mock(status_code=200,json=lambda:{'success':True})]
                self.assertEqual(len(deploy.health()),count)


if __name__ == '__main__':
    unittest.main()
