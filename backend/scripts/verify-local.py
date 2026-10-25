"""HTTP verification for the explicitly requested three-service local demo."""
import http.cookiejar
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend'))
from dotenv import dotenv_values

env = dotenv_values(root / 'backend/.env')
base = 'http://127.0.0.1:5000'
origin = 'http://127.0.0.1:3001'
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def request(path, body=None, headers=None):
    headers = {'Origin': origin, **(headers or {})}
    payload = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        payload = json.dumps(body).encode()
    with client.open(urllib.request.Request(base + path, data=payload, headers=headers), timeout=30) as response:
        return json.load(response)


health = request('/api/health')
assert health['success']
is_demo = health['authMode'] == 'demo'
assert request('/api/health/database')['database'] == ('disabled_demo' if is_demo else 'connected')
login = request('/api/admin/login', {'username': env['DEMO_ADMIN_USERNAME'], 'password': env['DEMO_ADMIN_PASSWORD']})
assert login['success'] and login['user']['role'] == 'admin'
assert any(cookie.name == 'alltoolnexa_admin_session' for cookie in cookies)
assert request('/api/admin/session')['user']['username'] == env['DEMO_ADMIN_USERNAME']
assert len(request('/api/admin/catalog')['tools']) >= 464
assert request('/api/admin/health')['database'] == ('disabled' if is_demo else 'connected')
assert request('/api/admin/logout', {}, {'X-CSRF-Token': login['csrfToken']})['success']
try:
    request('/api/admin/catalog')
    raise AssertionError('Signed-out request must be rejected.')
except urllib.error.HTTPError as error:
    assert error.code == 401
print('Backend: health, configured storage, JWT login cookie, authenticated catalog, CSRF logout and access protection passed.')

for url, needle in [
    ('http://127.0.0.1:3000/', 'All The Tools You Need'),
    ('http://127.0.0.1:3000/login', 'Email address'),
    ('http://127.0.0.1:3000/tools/percentage-calculator', 'Percentage Calculator'),
    ('http://127.0.0.1:3000/tools/pdf-merge', 'PDF Merge'),
    ('http://127.0.0.1:3001/', 'ADMIN WORKSPACE'),
]:
    with urllib.request.urlopen(url, timeout=150) as response:
        assert response.status == 200
        html = response.read().decode()
        assert needle in html, url
    print('HTTP 200:', url)
print('All three services are running. Frontend and admin render; JWT administrator credentials work with the configured storage.')
