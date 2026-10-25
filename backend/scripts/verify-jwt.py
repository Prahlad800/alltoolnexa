"""Verify the configured live database login without printing tokens or secrets."""
import http.cookiejar
import json
import re
import sys
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from dotenv import dotenv_values
from app import create_app
from database import db
from jwt_auth import COOKIES
from models import User

env = dotenv_values(root / '.env')
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def request(path, body=None, csrf=None):
    headers = {'Origin': 'http://127.0.0.1:3001'}
    if csrf:
        headers['X-CSRF-Token'] = csrf
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request('http://127.0.0.1:5000' + path,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers)
    with client.open(req, timeout=30) as response:
        return json.load(response)


assert request('/api/health')['authMode'] == 'database'
assert request('/api/health/database')['database'] == 'connected'
login = request('/api/admin/login', {'username': env['DEMO_ADMIN_USERNAME'], 'password': env['DEMO_ADMIN_PASSWORD']})
assert login['user']['role'] == 'admin'
raw = next(c.value for c in cookies if c.name == COOKIES['admin'])
assert raw.count('.') == 2
app = create_app()
with app.app_context():
    admin = db.session.query(User).filter_by(username=env['DEMO_ADMIN_USERNAME']).one()
    assert admin.role == 'admin' and admin.is_active
    assert admin.password_hash.startswith('scrypt:')
    assert admin.password_hash != env['DEMO_ADMIN_PASSWORD']
    assert admin.check_password(env['DEMO_ADMIN_PASSWORD'])
    # A fresh application instance has no in-memory sessions from the server.
    other = app.test_client()
    other.set_cookie(COOKIES['admin'], raw)
    assert other.get('/api/admin/session').status_code == 200
    if '--cleanup-fixture' in sys.argv:
        fixture = root.parent / 'frontend/logs/jwt-login-fixture.json'
        email = json.loads(fixture.read_text(encoding='utf-8'))['email']
        assert re.fullmatch(r'browser-\d+@example\.com', email)
        user = db.session.query(User).filter_by(email=email, role='user').one_or_none()
        if user:
            assert user.check_password('Browser-only-long-password!2026')
            db.session.delete(user)
            db.session.commit()
        print('Exact browser-test fixture removed; administrator retained.')
assert request('/api/admin/logout', {}, login['csrfToken'])['success']
print('PASS: Supabase connection, stored administrator, hashed password, live JWT login, persistent session across app instances, CSRF logout.')
