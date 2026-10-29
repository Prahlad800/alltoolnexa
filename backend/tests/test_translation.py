import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import test_jwt_auth as auth_tests
from translation_engine import ArgosEngine, TranslationUnavailable, TranslationBusy
from database import db
from models import BillingOrder, User


class TranslationTests(unittest.TestCase):
    setUp = auth_tests.JWTDatabaseTests.setUp
    tearDown = auth_tests.JWTDatabaseTests.tearDown

    def signup(self):
        response = self.client.post('/api/auth/signup', json={
            'email': 'translator@example.com', 'password': auth_tests.PASSWORD,
        }, headers=auth_tests.ORIGIN)
        return {**auth_tests.ORIGIN, 'X-CSRF-Token': response.json['csrfToken']}

    def translate(self, **payload):
        return self.client.post('/api/i18n/translate', json={
            'text': 'Hello world', 'source': 'en', 'target': 'hi', **payload,
        }, headers=auth_tests.ORIGIN)

    def test_server_owned_entitlements_and_anonymous_free_access(self):
        anonymous = self.client.get('/api/me')
        self.assertFalse(anonymous.json['is_premium'])
        self.assertEqual(anonymous.json['allowed_languages'], ['en', 'hi'])
        self.signup()
        with patch('localization.entitlement', return_value={'id': 'free'}):
            self.assertFalse(self.client.get('/api/me?is_premium=true').json['is_premium'])
        with patch('localization.entitlement', return_value={'id': 'premium-plus'}):
            premium = self.client.get('/api/me').json
            self.assertTrue(premium['is_premium'])
            self.assertEqual(len(premium['allowed_languages']), 26)
            self.assertIn('fr', premium['allowed_languages'])

    def test_free_translation_and_no_storage_or_public_cache(self):
        with patch.object(self.app.extensions['translation_engine'], 'translate', return_value='नमस्ते दुनिया') as engine:
            response = self.translate()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['translation'], 'नमस्ते दुनिया')
            engine.assert_called_once_with('Hello world', 'en', 'hi')
        self.assertIn('private', response.headers['Cache-Control'])
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_real_database_plan_and_expiry(self):
        self.signup()
        self.assertEqual(self.client.get('/api/me').json['plan'], 'free')
        user = db.session.query(User).filter_by(email='translator@example.com').one()
        order = BillingOrder(id='order_languages', user_id=user.id, plan_id='premium',
                             amount=19900, payment_id='pay_languages',
                             paid_until=datetime.now(timezone.utc) + timedelta(days=1))
        db.session.add(order)
        db.session.commit()
        self.assertTrue(self.client.get('/api/me').json['is_premium'])
        self.assertEqual(self.client.get('/api/i18n/messages/fr').status_code, 200)
        order.paid_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        self.assertFalse(self.client.get('/api/me').json['is_premium'])
        self.assertEqual(self.client.get('/api/i18n/messages/fr').status_code, 403)

    def test_input_validation_does_not_invoke_inference(self):
        with patch.object(self.app.extensions['translation_engine'], 'translate') as engine:
            for payload in [{'text': ''}, {'text': ' '}, {'text': 'x'*2001}, {'text': []}, {'source': []}, {'target': 'xx'}]:
                self.assertEqual(self.translate(**payload).status_code, 400)
            self.assertEqual(self.client.post('/api/i18n/translate', json=[], headers=auth_tests.ORIGIN).status_code, 400)
            engine.assert_not_called()

    def test_both_languages_require_entitlement_and_cannot_be_spoofed(self):
        with patch.object(self.app.extensions['translation_engine'], 'translate') as engine:
            self.assertEqual(self.translate(target='fr', is_premium=True).status_code, 403)
            self.assertEqual(self.translate(source='fr', target='hi').status_code, 403)
            engine.assert_not_called()
        headers = self.signup()
        with patch('localization.entitlement', return_value={'id': 'premium'}), patch.object(self.app.extensions['translation_engine'], 'translate', return_value='Bonjour'):
            result = self.client.post('/api/i18n/translate', json={'text': 'Hello', 'source': 'en', 'target': 'fr'}, headers=headers)
            self.assertEqual(result.status_code, 200)
        with patch('localization.entitlement', return_value={'id': 'free'}):
            result = self.client.post('/api/i18n/translate', json={'text': 'Hello', 'source': 'en', 'target': 'fr'}, headers=headers)
            self.assertEqual(result.status_code, 403)

    def test_origin_csrf_and_preflight(self):
        self.assertEqual(self.client.post('/api/i18n/translate', json={'text': 'hello'}).status_code, 403)
        self.assertEqual(self.client.post('/api/i18n/translate', json={}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.signup()
        self.assertEqual(self.translate().status_code, 403)
        result = self.client.options('/api/i18n/translate', headers={**auth_tests.ORIGIN, 'Access-Control-Request-Method': 'POST'})
        self.assertEqual(result.status_code, 204)
        self.assertIn('X-CSRF-Token', result.headers['Access-Control-Allow-Headers'])
        self.assertEqual(result.headers['Access-Control-Allow-Origin'], auth_tests.ORIGIN['Origin'])

    def test_missing_engine_busy_and_rate_limit(self):
        with patch.object(self.app.extensions['translation_engine'], 'translate', side_effect=TranslationUnavailable('private path')):
            result = self.translate()
            self.assertEqual(result.status_code, 503)
            self.assertNotIn('private path', result.text)
        with patch.object(self.app.extensions['translation_engine'], 'translate', side_effect=TranslationBusy()):
            self.assertEqual(self.translate().status_code, 429)
        with patch.object(self.app.extensions['translation_engine'], 'translate', return_value='नमस्ते'):
            for _ in range(18):
                self.assertEqual(self.translate().status_code, 200)
            self.assertEqual(self.translate().status_code, 429)


class EngineTests(unittest.TestCase):
    def test_optional_dependency_is_not_imported_when_disabled(self):
        with patch.dict(os.environ, {'ARGOS_TRANSLATE_ENABLED': 'false'}), patch('translation_engine.importlib.import_module') as load:
            with self.assertRaises(TranslationUnavailable):
                ArgosEngine().translate('Hello', 'en', 'hi')
            load.assert_not_called()

    def test_installed_model_inference_and_worker_recovery(self):
        source, target = Mock(code='en'), Mock(code='hi')
        source.get_translation.return_value.translate.return_value = 'नमस्ते'
        module = Mock()
        module.get_installed_languages.return_value = [source, target]
        engine = ArgosEngine()
        with patch.dict(os.environ, {'ARGOS_TRANSLATE_ENABLED': 'true'}), patch('translation_engine.importlib.import_module', return_value=module):
            self.assertEqual(engine.translate('Hello', 'en', 'hi'), 'नमस्ते')
            source.get_translation.return_value.translate.side_effect = RuntimeError('private path')
            with self.assertRaises(TranslationUnavailable):
                engine.translate('Hello', 'en', 'hi')
            source.get_translation.return_value.translate.side_effect = None
            self.assertEqual(engine.translate('Hello', 'en', 'hi'), 'नमस्ते')
            with self.assertRaises(TranslationUnavailable):
                engine.translate('Hello', 'en', 'fr')

    def test_missing_optional_library_does_not_break_web_startup(self):
        with patch.dict(os.environ, {'ARGOS_TRANSLATE_ENABLED': 'true'}), patch('translation_engine.importlib.import_module', side_effect=ImportError):
            with self.assertRaises(TranslationUnavailable):
                ArgosEngine().translate('Hello', 'en', 'hi')
