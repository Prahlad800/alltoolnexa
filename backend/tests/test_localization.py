import json
import os
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
import test_jwt_auth as auth_tests

class LocalizationTests(unittest.TestCase):
    setUp=auth_tests.JWTDatabaseTests.setUp
    tearDown=auth_tests.JWTDatabaseTests.tearDown

    def test_free_locales_are_anonymous_and_unknown_locales_rejected(self):
        for locale in ['en','hi']:
            result=self.client.get('/api/i18n/messages/'+locale)
            self.assertEqual(result.status_code,200)
            self.assertTrue(result.json['free'])
        self.assertEqual(self.client.get('/api/i18n/messages/unknown').status_code,400)
        self.assertEqual(self.client.get('/api/i18n/messages/fr',headers={'Accept-Language':'hi'}).json['code'],'LOGIN_REQUIRED')
        self.assertIn('लॉग इन',self.client.get('/api/i18n/messages/fr',headers={'Accept-Language':'hi'}).json['message'])

    def test_premium_requires_server_entitlement_and_configured_catalog(self):
        self.client.post('/api/auth/signup',json={'email':'languages@example.com','password':auth_tests.PASSWORD},headers=auth_tests.ORIGIN)
        with patch('localization.entitlement',return_value={'id':'basic'}):
            result=self.client.get('/api/i18n/messages/fr?plan=premium')
            self.assertEqual(result.status_code,403)
            self.assertEqual(result.json['code'],'PREMIUM_REQUIRED')
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'I18N_CATALOG_DIR':directory}),patch('localization.entitlement',return_value={'id':'premium'}):
            self.assertEqual(self.client.get('/api/i18n/messages/fr').status_code,503)
            Path(directory,'fr.json').write_text(json.dumps({'Home':'Accueil'}),encoding='utf-8')
            result=self.client.get('/api/i18n/messages/fr')
            self.assertEqual(result.status_code,200)
            self.assertEqual(result.json['messages']['Home'],'Accueil')
            self.assertIn('no-store',result.headers['Cache-Control'])
            Path(directory,'fr.json').write_text('[]',encoding='utf-8')
            self.assertEqual(self.client.get('/api/i18n/messages/fr').status_code,503)
        self.assertEqual(self.client.get('/api/i18n/messages/en',headers={'Origin':'https://untrusted.example'}).status_code,403)
