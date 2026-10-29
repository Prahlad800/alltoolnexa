import io
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from deploy_backend import Deployment, check_database_from_runner, classify_database_error, deployable, update_environment, production_origin_settings
from dotenv import dotenv_values


class DeployTests(unittest.TestCase):
    def test_production_origins_preserve_existing_and_enable_secure_cookies(self):
        settings={'AUTH_ALLOWED_ORIGINS':'https://admin.example.com,https://alltoolnexa.pages.dev'}
        result=production_origin_settings(settings,'https://alltoolnexa.pages.dev/')
        self.assertEqual(result['AUTH_ALLOWED_ORIGINS'],settings['AUTH_ALLOWED_ORIGINS'])
        self.assertEqual(result['AUTH_COOKIE_SECURE'],'true')
        self.assertEqual(production_origin_settings(settings,''),{})

    def test_invalid_production_origins_are_rejected(self):
        for origin in ['http://example.com','https://localhost','https://127.0.0.1','https://example.com/path','https://user:pass@example.com','https://example.com?query=1']:
            with self.subTest(origin=origin), self.assertRaises(RuntimeError):
                production_origin_settings({},origin)

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


class AnnualRPCDeploymentTests(unittest.TestCase):
    def test_ready_rpc_needs_no_database_credentials_or_writes(self):
        from deploy_backend import enable_annual_rpc
        client=Mock();client.call.return_value={'connected':True,'billingCycles':['monthly','yearly'],'annualPrices':{'basic':349,'pro':949,'premium':1599,'premium-plus':2000}}
        with patch('deploy_backend.create_engine') as engine:
            self.assertTrue(enable_annual_rpc(client,'https://project.supabase.co',''));engine.assert_not_called()

    def test_missing_or_mismatched_database_identity_never_executes_sql(self):
        from deploy_backend import enable_annual_rpc
        client=Mock();client.call.return_value={'connected':True}
        with patch('deploy_backend.create_engine') as engine:
            for url in ['', 'postgresql://postgres:fake@db.other.supabase.co/postgres','postgresql://postgres.other:fake@aws-0-test.pooler.supabase.com/postgres','postgresql://postgres.project:fake@aws-0-test.pooler.supabase.com:6543/postgres']:
                self.assertFalse(enable_annual_rpc(client,'https://project.supabase.co',url))
            engine.assert_not_called()

    def test_stale_price_contract_does_not_claim_annual_ready(self):
        from deploy_backend import enable_annual_rpc
        client=Mock();client.call.return_value={'connected':True,'billingCycles':['monthly','yearly'],'annualPrices':{'basic':300}}
        with patch('deploy_backend.create_engine') as engine:
            self.assertFalse(enable_annual_rpc(client,'https://project.supabase.co',''));engine.assert_not_called()

    def test_matched_binding_runs_transaction_then_checks_capability(self):
        from deploy_backend import enable_annual_rpc
        from unittest.mock import MagicMock
        client=Mock();client.call.side_effect=[{'connected':True},{'connected':True,'billingCycles':['monthly','yearly'],'annualPrices':{'basic':349,'pro':949,'premium':1599,'premium-plus':2000}}]
        engine=MagicMock()
        with patch('deploy_backend.create_engine',return_value=engine):
            self.assertTrue(enable_annual_rpc(client,'https://project.supabase.co','postgresql://postgres.project:fake@aws-0-test.pooler.supabase.com:5432/postgres'))
            sql=str(engine.begin.return_value.__enter__.return_value.execute.call_args.args[0])
            self.assertIn('make_interval(months=>term_months)',sql);engine.dispose.assert_called_once()

    def test_database_failure_is_safe_and_does_not_claim_annual_ready(self):
        from deploy_backend import enable_annual_rpc
        client=Mock();client.call.return_value={'connected':True}
        with patch('deploy_backend.create_engine',side_effect=RuntimeError('do-not-echo-secret')):
            self.assertFalse(enable_annual_rpc(client,'https://project.supabase.co','postgresql://postgres:fake@db.project.supabase.co:5432/postgres'))


class AnnualHealthTests(unittest.TestCase):
    @patch('deploy_backend.requests.get')
    def test_annual_enabled_deployment_checks_catalog_and_capability(self,get):
        deploy=Deployment.__new__(Deployment);deploy.domain='app.example';deploy.expected_annual=True
        for cycles,count in [(['monthly'],1),(['monthly','yearly'],0)]:
            get.side_effect=[Mock(status_code=200,json=lambda:{'success':True,'authMode':'database'}),Mock(status_code=200,json=lambda:{'success':True,'database':'connected'}),Mock(status_code=200,json=lambda:{'success':True}),Mock(status_code=200,json=lambda:{'billingCycles':cycles,'plans':[{'id':key,'annualPrice':value} for key,value in {'basic':349,'pro':949,'premium':1599,'premium-plus':2000}.items()]})]
            self.assertEqual(len(deploy.health()),count)


if __name__ == '__main__':
    unittest.main()
