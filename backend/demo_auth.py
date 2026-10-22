"""Loopback-only demo authentication. No database, no persistent sessions."""
import hashlib
import hmac
import json
import secrets
import threading
import time
from collections import deque
from functools import wraps
from pathlib import Path

from flask import jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

COOKIE = 'alltoolnexa_demo_session'
TTL = 8 * 60 * 60


def init_demo_auth(app):
    enabled = app.config.get('AUTH_MODE') == 'demo'
    username = app.config.get('DEMO_ADMIN_USERNAME', 'admin')
    email = app.config.get('DEMO_ADMIN_EMAIL', 'admin@alltoolnexa.local')
    password = app.config.get('DEMO_ADMIN_PASSWORD', '')
    if enabled and len(password) < 12:
        raise ValueError('Set DEMO_ADMIN_PASSWORD to at least 12 characters for local demo mode.')
    password_hash = generate_password_hash(password) if enabled else ''
    sessions = {}
    failures = deque(maxlen=10)
    lock = threading.Lock()
    started = time.monotonic()
    origins = set(app.config.get('DEMO_ALLOWED_ORIGINS', []))

    def current():
        token = request.cookies.get(COOKIE, '')
        digest = hashlib.sha256(token.encode()).hexdigest()
        with lock:
            record = sessions.get(digest)
            if record and record['expires'] <= time.time():
                sessions.pop(digest, None)
                record = None
        return digest, record

    @app.before_request
    def demo_boundary():
        if not request.path.startswith(('/api/auth/', '/api/admin/')):
            return None
        if not enabled:
            return jsonify(success=False, message='Local demo authentication is disabled.'), 503
        if request.remote_addr not in {'127.0.0.1', '::1'} or request.host.split(':')[0] not in {'localhost', '127.0.0.1', '[', '::1'}:
            return jsonify(success=False, message='Demo login is available on this computer only.'), 403
        origin = request.headers.get('Origin')
        if origin and origin not in origins:
            return jsonify(success=False, message='Origin is not allowed.'), 403
        if request.method == 'OPTIONS':
            return '', 204
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and origin not in origins:
            return jsonify(success=False, message='A trusted local origin is required.'), 403

    @app.after_request
    def demo_headers(response):
        if request.path.startswith(('/api/auth/', '/api/admin/')):
            response.headers['Cache-Control'] = 'no-store'
            origin = request.headers.get('Origin')
            if enabled and origin in origins:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
                response.vary.add('Origin')
        return response

    def authenticated(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            digest, record = current()
            if not record:
                return jsonify(success=False, message='Please sign in.'), 401
            if request.method != 'GET' and not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), record['csrf']):
                return jsonify(success=False, message='Invalid CSRF token.'), 403
            return fn(digest, record, *args, **kwargs)
        return wrapped

    def user():
        return {'username': username, 'email': email, 'role': 'admin', 'mode': 'demo'}

    @app.post('/api/auth/login')
    def demo_login():
        if not request.is_json:
            return jsonify(success=False, message='Send a JSON request.'), 415
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(success=False, message='Enter your username and password.'), 400
        identifier = payload.get('username', payload.get('email', ''))
        supplied = payload.get('password', '')
        if not isinstance(identifier, str) or not isinstance(supplied, str) or len(identifier) > 254 or len(supplied) > 256:
            return jsonify(success=False, message='Invalid sign-in details.'), 400
        with lock:
            while failures and time.monotonic() - failures[0] > 60:
                failures.popleft()
            if len(failures) >= 10:
                return jsonify(success=False, message='Too many attempts. Try again in a minute.'), 429
        valid_password = check_password_hash(password_hash, supplied)
        valid_identifier = identifier.strip().lower() in {username.lower(), email.lower()}
        if not (valid_identifier and valid_password):
            with lock:
                failures.append(time.monotonic())
            return jsonify(success=False, message='Incorrect username or password.'), 401
        raw = secrets.token_urlsafe(32)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        csrf = secrets.token_urlsafe(32)
        with lock:
            old_digest, _ = None, None
            old = request.cookies.get(COOKIE)
            if old:
                sessions.pop(hashlib.sha256(old.encode()).hexdigest(), None)
            for key in [key for key, record in sessions.items() if record['expires'] <= time.time()]:
                sessions.pop(key)
            sessions[digest] = {'csrf': csrf, 'expires': time.time() + TTL}
        response = jsonify(success=True, user=user(), csrfToken=csrf)
        response.set_cookie(COOKIE, raw, max_age=TTL, httponly=True, secure=False, samesite='Lax', path='/')
        return response

    @app.get('/api/auth/session')
    @authenticated
    def demo_session(digest, record):
        return jsonify(success=True, user=user(), csrfToken=record['csrf'])

    @app.post('/api/auth/logout')
    @authenticated
    def demo_logout(digest, record):
        with lock:
            sessions.pop(digest, None)
        response = jsonify(success=True)
        response.delete_cookie(COOKIE, path='/', httponly=True, samesite='Lax')
        return response

    @app.get('/api/admin/catalog')
    @authenticated
    def admin_catalog(digest, record):
        root = Path(__file__).resolve().parents[1] / 'shared'
        try:
            def read(name):
                return json.loads((root / name).read_text(encoding='utf-8-sig'))
            return jsonify(success=True, tools=read('published-tools.json'), inventory=read('inventory.json'), stats=read('implementation-status.json'))
        except (OSError, ValueError):
            return jsonify(success=False, message='Run npm run inventory in the project folder first.'), 503

    @app.get('/api/admin/health')
    @authenticated
    def admin_health(digest, record):
        return jsonify(success=True, backend='running', authMode='local-demo', database='disabled', uptimeSeconds=int(time.monotonic() - started))
