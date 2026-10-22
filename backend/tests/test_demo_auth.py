import unittest
from unittest.mock import patch

from app import create_app

ORIGIN = {'Origin': 'http://localhost:3001'}


class DemoAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'AUTH_MODE': 'demo', 'DEMO_ADMIN_USERNAME': 'admin', 'DEMO_ADMIN_PASSWORD': 'Local-Test-Password!123'})
        self.client = self.app.test_client()

    def login(self):
        return self.client.post('/api/auth/login', json={'username': 'admin', 'password': 'Local-Test-Password!123'}, headers=ORIGIN)

    def test_demo_starts_without_a_database(self):
        self.assertNotIn('sqlalchemy', self.app.extensions)
        self.assertEqual(self.client.get('/api/health/database').json['database'], 'disabled_demo')

    def test_login_cookie_session_admin_and_logout(self):
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 401)
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])
        self.assertEqual(self.client.get('/api/auth/session').json['user']['role'], 'admin')
        self.assertGreater(len(self.client.get('/api/admin/catalog').json['tools']), 400)
        self.assertEqual(self.client.post('/api/auth/logout', headers=ORIGIN).status_code, 403)
        headers = {**ORIGIN, 'X-CSRF-Token': response.json['csrfToken']}
        self.assertEqual(self.client.post('/api/auth/logout', headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)

    def test_credentials_origin_and_remote_access_are_checked(self):
        self.assertEqual(self.client.post('/api/auth/login', json={'username': 'admin', 'password': 'wrong'}, headers=ORIGIN).status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', json={}, headers={'Origin': 'https://external.example'}).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/health', environ_base={'REMOTE_ADDR': '192.168.1.12'}).status_code, 403)

    def test_sessions_do_not_survive_a_restart(self):
        self.login()
        other = create_app({'TESTING': True, 'AUTH_MODE': 'demo', 'DEMO_ADMIN_PASSWORD': 'Local-Test-Password!123'})
        self.assertEqual(other.test_client().get('/api/auth/session').status_code, 401)

    def test_auth_is_disabled_in_database_mode(self):
        with patch.dict('os.environ', {'DATABASE_URL': ''}):
            other = create_app({'TESTING': True, 'AUTH_MODE': 'database'})
        self.assertEqual(other.test_client().get('/api/auth/session').status_code, 503)
