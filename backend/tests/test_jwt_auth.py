import os
import unittest
from unittest.mock import patch

import jwt
from sqlalchemy import event

from app import create_app
from database import db
from jwt_auth import COOKIES, ISSUER
from models import AuthSession, User

ORIGIN = {'Origin': 'http://localhost:3000'}
ADMIN_ORIGIN = {'Origin': 'http://localhost:3001'}
PASSWORD = 'A-long-user-password!2026'
SECRET = 'test-only-jwt-secret-with-at-least-32-bytes'


class JWTAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'AUTH_MODE': 'demo', 'JWT_SECRET_KEY': SECRET,
                               'DEMO_ADMIN_PASSWORD': PASSWORD})
        self.client = self.app.test_client()

    def signup(self, email='member@example.com', **extra):
        return self.client.post('/api/auth/signup', json={'email': email, 'password': PASSWORD, **extra}, headers=ORIGIN)

    def test_user_signup_jwt_session_logout_and_revocation(self):
        result = self.signup()
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json['user']['role'], 'user')
        self.assertNotIn('password_hash', result.json['user'])
        self.assertNotIn('accessToken', result.json)
        raw = self.client.get_cookie(COOKIES['user']).value
        claims = jwt.decode(raw, SECRET, algorithms=['HS256'], issuer=ISSUER, audience='alltoolnexa-user')
        self.assertEqual(claims['role'], 'user')
        self.assertIn('HttpOnly', result.headers['Set-Cookie'])
        self.assertEqual(self.client.get('/api/auth/session').json['user']['email'], 'member@example.com')
        self.assertEqual(self.client.post('/api/auth/logout', json={}, headers=ORIGIN).status_code, 403)
        self.assertEqual(self.client.post('/api/auth/logout', json={}, headers={**ORIGIN, 'X-CSRF-Token': result.json['csrfToken']}).status_code, 200)
        self.client.set_cookie(COOKIES['user'], raw)
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)

    def test_separate_admin_and_user_cookies_and_role_protection(self):
        self.signup()
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 401)
        self.assertEqual(self.client.post('/api/admin/login', json={'email': 'member@example.com', 'password': PASSWORD}, headers=ADMIN_ORIGIN).status_code, 401)
        admin = self.client.post('/api/admin/login', json={'username': 'admin', 'password': PASSWORD}, headers=ADMIN_ORIGIN)
        self.assertEqual(admin.status_code, 200)
        self.assertEqual(self.client.get('/api/admin/session').json['user']['role'], 'admin')
        self.assertEqual(self.client.get('/api/auth/session').json['user']['role'], 'user')
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 200)
        self.client.post('/api/admin/logout', json={}, headers={**ADMIN_ORIGIN, 'X-CSRF-Token': admin.json['csrfToken']})
        self.assertEqual(self.client.get('/api/auth/session').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/session').status_code, 401)

    def test_signup_validation_duplicate_and_no_public_admin(self):
        self.assertEqual(self.signup(role='admin').status_code, 400)
        self.assertEqual(self.signup(email='bad-email').status_code, 400)
        self.assertEqual(self.signup(password='short').status_code, 400)
        self.assertEqual(self.signup().status_code, 201)
        self.assertEqual(self.signup(email=' MEMBER@EXAMPLE.COM ').status_code, 409)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'MEMBER@example.com', 'password': PASSWORD}, headers=ORIGIN).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'admin@alltoolnexa.local', 'password': PASSWORD}, headers=ORIGIN).status_code, 401)

    def test_secure_cookie_supports_separate_frontend_site(self):
        app=create_app({'TESTING':True,'AUTH_MODE':'demo','JWT_SECRET_KEY':SECRET,'DEMO_ADMIN_PASSWORD':PASSWORD,'AUTH_COOKIE_SECURE':True})
        client=app.test_client()
        result=client.post('/api/auth/signup',json={'email':'secure@example.com','password':'Abc123!x'},headers=ORIGIN)
        self.assertEqual(result.status_code,201)
        self.assertIn('SameSite=None',result.headers['Set-Cookie'])
        self.assertIn('Secure;',result.headers['Set-Cookie'])

    def test_eight_character_password_boundary(self):
        self.assertEqual(self.signup(email='short@example.com', password='Abc123!').status_code, 400)
        self.assertEqual(self.signup(email='eight@example.com', password='Abc123!x').status_code, 201)
        self.assertEqual(self.client.post('/api/auth/login', json={'email':'eight@example.com','password':'Abc123!x'}, headers=ORIGIN).status_code, 200)

    def test_tampered_wrong_audience_and_expired_tokens_rejected(self):
        self.signup()
        raw = self.client.get_cookie(COOKIES['user']).value
        pieces = raw.split('.')
        pieces[1] = pieces[1][:-2] + 'ab'
        self.client.set_cookie(COOKIES['user'], '.'.join(pieces))
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)
        self.client.set_cookie(COOKIES['admin'], raw)
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 401)
        claims = jwt.decode(raw, SECRET, algorithms=['HS256'], audience='alltoolnexa-user')
        claims['exp'] = 1
        self.client.set_cookie(COOKIES['user'], jwt.encode(claims, SECRET, algorithm='HS256', headers={'typ': 'at+jwt'}))
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)

    @patch("jwt_auth.time.monotonic", return_value=1000.0)
    def test_origin_csrf_and_rate_limit(self, _clock):
        self.assertEqual(self.client.post('/api/auth/signup', json={}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/auth/login', json={}).status_code, 403)
        for _ in range(20):
            self.client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'wrong'}, headers=ORIGIN)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'wrong'}, headers=ORIGIN).status_code, 429)


class JWTDatabaseTests(unittest.TestCase):
    def setUp(self):
        with patch.dict(os.environ, {'DATABASE_URL': ''}):
            self.app = create_app({'TESTING': True, 'AUTH_MODE': 'database', 'JWT_SECRET_KEY': SECRET,
                                   'SQLALCHEMY_DATABASE_URI': 'sqlite://', 'SQLALCHEMY_ENGINE_OPTIONS': {},
                                   'AUTH_COOKIE_SECURE': False})
        self.context = self.app.app_context()
        self.context.push()

        @event.listens_for(db.engine, 'connect')
        def attach_schema(connection, record):
            connection.execute("ATTACH DATABASE ':memory:' AS alltoolnexa_private")
            connection.execute('PRAGMA foreign_keys=ON')
        db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.engine.dispose()
        self.context.pop()

    def test_database_signup_session_and_logout(self):
        result = self.client.post('/api/auth/signup', json={'email': 'saved@example.com', 'password': PASSWORD}, headers=ORIGIN)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(db.session.query(User).count(), 1)
        self.assertEqual(db.session.query(AuthSession).count(), 1)
        self.assertEqual(db.session.query(User).first().role, 'user')
        self.assertEqual(self.client.get('/api/auth/session').status_code, 200)
        self.client.post('/api/auth/logout', json={}, headers={**ORIGIN, 'X-CSRF-Token': result.json['csrfToken']})
        self.assertEqual(db.session.query(AuthSession).count(), 0)
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)

    def test_database_roles_and_deactivated_accounts(self):
        user = User(email='owner@example.com', role='admin')
        user.set_password(PASSWORD)
        db.session.add(user)
        db.session.commit()
        self.assertEqual(self.client.post('/api/auth/login', json={'email': user.email, 'password': PASSWORD}, headers=ORIGIN).status_code, 401)
        self.assertEqual(self.client.post('/api/admin/login', json={'email': user.email, 'password': PASSWORD}, headers=ADMIN_ORIGIN).status_code, 200)
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 200)
        user.is_active = False
        db.session.commit()
        self.assertEqual(self.client.get('/api/admin/catalog').status_code, 401)

    def test_admin_console_creates_admin_but_never_overwrites_existing_user(self):
        runner = self.app.test_cli_runner()
        result = runner.invoke(args=['create-admin', '--email', 'console@example.com', '--password', PASSWORD])
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertEqual(db.session.query(User).filter_by(email='console@example.com').one().role, 'admin')
        duplicate = runner.invoke(args=['create-admin', '--email', 'console@example.com', '--password', PASSWORD])
        self.assertNotEqual(duplicate.exit_code, 0)
        self.assertEqual(db.session.query(User).count(), 1)
