"""Separate user/admin JWT cookies with revocable server-side sessions."""
import hashlib
import hmac
import json
import re
import secrets
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import jwt
from flask import jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash

from database import db
from models import AuthSession, User

COOKIES = {'user': 'alltoolnexa_user_session', 'admin': 'alltoolnexa_admin_session'}
ISSUER = 'alltoolnexa-api'
TTL = 8 * 60 * 60


def init_auth(app):
    demo = app.config['AUTH_MODE'] == 'demo'
    store = app.extensions.get('supabase_store')
    secret = app.config.get('JWT_SECRET_KEY', '')
    if not secret and demo:
        secret = secrets.token_hex(32)
    if secret and len(secret.encode()) < 32:
        raise ValueError('JWT_SECRET_KEY must contain at least 32 bytes.')
    ready = bool(secret) and (demo or store or 'sqlalchemy' in app.extensions)
    admin_email = app.config['DEMO_ADMIN_EMAIL'].strip().lower()
    admin_name = app.config['DEMO_ADMIN_USERNAME']
    admin_password = app.config['DEMO_ADMIN_PASSWORD']
    if demo and len(admin_password) < 8:
        raise ValueError('Set DEMO_ADMIN_PASSWORD to at least 8 characters for local demo mode.')
    dummy_hash = generate_password_hash(secrets.token_urlsafe(32))
    admin_hash = generate_password_hash(admin_password) if demo else dummy_hash
    users, sessions, attempts = {}, {}, {}
    lock = threading.RLock()
    started = time.monotonic()
    def rollback():
        if 'sqlalchemy' in app.extensions:
            db.session.rollback()
    origins = set(app.config.get('AUTH_ALLOWED_ORIGINS', app.config.get('DEMO_ALLOWED_ORIGINS', [])))
    secure = app.config.get('AUTH_COOKIE_SECURE', not demo)

    def failure(message, status):
        return jsonify(success=False, message=message), status

    @app.before_request
    def auth_boundary():
        if not request.path.startswith(('/api/auth/', '/api/admin/')):
            return None
        if demo and (request.remote_addr not in {'127.0.0.1', '::1'} or request.host.split(':')[0] not in {'localhost', '127.0.0.1', '[', '::1'}):
            return failure('Demo login is available on this computer only.', 403)
        origin = request.headers.get('Origin')
        if origin and origin not in origins:
            return failure('Origin is not allowed.', 403)
        if request.method == 'OPTIONS':
            return '', 204
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and origin not in origins:
            return failure('A trusted application origin is required.', 403)
        if not ready:
            return failure('Authentication is not configured. Configure the database and JWT secret.', 503)

    @app.after_request
    def auth_headers(response):
        if request.path.startswith(('/api/auth/', '/api/admin/')):
            response.headers['Cache-Control'] = 'no-store'
            origin = request.headers.get('Origin')
            if origin in origins:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Credentials'] = 'true'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
                response.vary.add('Origin')
        return response

    def rate_limited(scope, limit):
        now = time.monotonic()
        key = (request.remote_addr, scope)
        with lock:
            for old in [k for k, v in attempts.items() if not v or now - v[-1] > 60]:
                del attempts[old]
            if key not in attempts and len(attempts) >= 1000:
                return True
            bucket = attempts.setdefault(key, deque())
            while bucket and now - bucket[0] > 60:
                bucket.popleft()
            if len(bucket) >= limit:
                return True
            bucket.append(now)
        return False

    def csrf_for(jti):
        return hmac.new(secret.encode(), ('csrf:' + jti).encode(), hashlib.sha256).hexdigest()

    def public_user(user):
        if isinstance(user, dict):
            return {k: user[k] for k in ('id', 'username', 'email', 'role')} | {'username': user.get('username') or user['email'].split('@')[0], 'mode': 'demo' if demo else 'database'}
        return {'id': str(user.id), 'username': user.username or user.email.split('@')[0], 'email': user.email, 'role': user.role, 'mode': 'database'}

    def issue(user, scope, status=200):
        user_data = public_user(user)
        now = datetime.now(timezone.utc)
        jti = str(uuid.uuid4())
        raw = jwt.encode({'sub': user_data['id'], 'role': user_data['role'], 'jti': jti,
                          'iss': ISSUER, 'aud': 'alltoolnexa-' + scope,
                          'iat': now, 'nbf': now, 'exp': now + timedelta(seconds=TTL)},
                         secret, algorithm='HS256', headers={'typ': 'at+jwt'})
        digest = hashlib.sha256(raw.encode()).hexdigest()
        if demo:
            with lock:
                for key in [k for k, v in sessions.items() if v['expires'] <= time.time()]:
                    sessions.pop(key)
                old = request.cookies.get(COOKIES[scope], '')
                sessions.pop(hashlib.sha256(old.encode()).hexdigest(), None)
                sessions[digest] = {'user': user_data, 'expires': time.time() + TTL, 'jti': jti}
        elif store:
            old = request.cookies.get(COOKIES[scope], '')
            store.call('session_issue', user_id=user_data['id'], digest=digest, old_digest=hashlib.sha256(old.encode()).hexdigest(), created_at=now, expires_at=now+timedelta(seconds=TTL))
        else:
            old = request.cookies.get(COOKIES[scope], '')
            db.session.query(AuthSession).filter_by(token_hash=hashlib.sha256(old.encode()).hexdigest()).delete()
            db.session.add(AuthSession(user_id=user.id, token_hash=digest, created_at=now, expires_at=now + timedelta(seconds=TTL)))
            db.session.commit()
        response = jsonify(success=True, user=user_data, csrfToken=csrf_for(jti), expiresIn=TTL)
        response.status_code = status
        response.set_cookie(COOKIES[scope], raw, max_age=TTL, httponly=True, secure=secure, samesite='None' if secure else 'Lax', path='/')
        # Invalidate the superseded opaque demo cookie in the browser.
        response.delete_cookie('alltoolnexa_demo_session', path='/')
        return response

    def current(scope):
        raw = request.cookies.get(COOKIES[scope], '')
        if not raw:
            return None
        try:
            claims = jwt.decode(raw, secret, algorithms=['HS256'], issuer=ISSUER,
                                audience='alltoolnexa-' + scope,
                                options={'require': ['sub', 'role', 'jti', 'iss', 'aud', 'iat', 'nbf', 'exp']})
            if jwt.get_unverified_header(raw).get('typ') != 'at+jwt' or claims['role'] != scope:
                return None
            digest = hashlib.sha256(raw.encode()).hexdigest()
            if demo:
                with lock:
                    record = sessions.get(digest)
                if not record or record['expires'] <= time.time() or record['user']['id'] != claims['sub'] or record['user']['role'] != scope:
                    return None
                user_data = record['user']
            elif store:
                user = store.call('session_current', digest=digest)
                if not user or user['id'] != claims['sub'] or user['role'] != scope:
                    return None
                user_data = public_user(user)
            else:
                session_record = db.session.query(AuthSession).filter_by(token_hash=digest).first()
                if not session_record or str(session_record.user_id) != claims['sub']:
                    return None
                expires = session_record.expires_at
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if expires <= datetime.now(timezone.utc):
                    return None
                user = db.session.get(User, session_record.user_id)
                if not user or not user.is_active or user.role != scope:
                    return None
                user_data = public_user(user)
            return {'user': user_data, 'digest': digest, 'csrf': csrf_for(claims['jti'])}
        except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
            return None

    def authenticated(scope):
        def decorate(fn):
            @wraps(fn)
            def wrapped(*args, **kwargs):
                try:
                    record = current(scope)
                    if not record:
                        return failure('Please sign in to the ' + scope + ' account.', 401)
                    if request.method != 'GET' and not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), record['csrf']):
                        return failure('Invalid CSRF token. Reload and try again.', 403)
                    return fn(record, *args, **kwargs)
                except SQLAlchemyError:
                    rollback()
                    return failure('Account service is unavailable. Please try again later.', 503)
            return wrapped
        return decorate

    def credentials():
        if not request.is_json:
            return None, failure('Send a JSON request.', 415)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return None, failure('Enter your email and password.', 400)
        identifier = payload.get('email', payload.get('username', ''))
        supplied = payload.get('password', '')
        if not isinstance(identifier, str) or not isinstance(supplied, str) or len(identifier) > 254 or not 1 <= len(supplied) <= 256:
            return None, failure('Enter valid sign-in details.', 400)
        return (identifier.strip().lower(), supplied, payload), None

    @app.get('/api/auth/config')
    def config():
        return jsonify(success=True, mode='demo' if demo else 'database', signupEnabled=True,
                       accountStorage='temporary-memory' if demo else 'database', sessionType='jwt-cookie')

    @app.post('/api/auth/signup')
    def signup():
        if rate_limited('signup', 10):
            return failure('Too many attempts. Try again in a minute.', 429)
        data, error = credentials()
        if error:
            return error
        email, password, payload = data
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or not 8 <= len(password) <= 256:
            return failure('Use a valid email and a password with 8 to 256 characters.', 400)
        if payload.get('role', 'user') != 'user':
            return failure('Public signup creates user accounts only.', 400)
        try:
            if demo:
                with lock:
                    if email == admin_email or email in users:
                        return failure('This email is already registered. Please sign in.', 409)
                    if len(users) >= 1000:
                        return failure('Local demo account capacity reached. Restart the demo to clear it.', 503)
                    user = {'id': str(uuid.uuid4()), 'username': email.split('@')[0], 'email': email,
                            'role': 'user', 'password_hash': generate_password_hash(password)}
                    users[email] = user
            elif store:
                user = store.call('user_create', id=str(uuid.uuid4()), email=email, password_hash=generate_password_hash(password))
            else:
                user = User(email=email, role='user')
                user.set_password(password)
                db.session.add(user)
                db.session.flush()
            return issue(user, 'user', 201)
        except IntegrityError:
            rollback()
            return failure('This email is already registered. Please sign in.', 409)
        except SQLAlchemyError:
            rollback()
            return failure('Account service is unavailable. Please try again later.', 503)

    def sign_in(scope):
        if rate_limited('login-' + scope, 20):
            return failure('Too many attempts. Try again in a minute.', 429)
        data, error = credentials()
        if error:
            return error
        identifier, password, _ = data
        try:
            if demo:
                if scope == 'admin':
                    user = {'id': 'demo-admin', 'username': admin_name, 'email': admin_email, 'role': 'admin'}
                    valid = check_password_hash(admin_hash, password) and identifier in {admin_name.lower(), admin_email}
                else:
                    with lock:
                        user = users.get(identifier)
                    valid = check_password_hash(user['password_hash'] if user else dummy_hash, password) and bool(user)
            elif store:
                user = store.call('user_find', field='username' if scope == 'admin' and '@' not in identifier else 'email', value=identifier)
                valid = check_password_hash(user['password_hash'] if user else dummy_hash, password) and bool(user and user['is_active'] and user['role'] == scope)
            else:
                query = db.session.query(User)
                user = query.filter_by(username=identifier).first() if scope == 'admin' and '@' not in identifier else query.filter_by(email=identifier).first()
                valid = check_password_hash(user.password_hash if user else dummy_hash, password) and bool(user and user.is_active and user.role == scope)
            if not valid:
                return failure('Incorrect email or password.', 401)
            return issue(user, scope)
        except SQLAlchemyError:
            rollback()
            return failure('Account service is unavailable. Please try again later.', 503)

    app.add_url_rule('/api/auth/login', 'user_login', lambda: sign_in('user'), methods=['POST'])
    app.add_url_rule('/api/admin/login', 'admin_login', lambda: sign_in('admin'), methods=['POST'])

    def session_response(record):
        return jsonify(success=True, user=record['user'], csrfToken=record['csrf'])

    def logout_response(scope, record):
        if demo:
            with lock:
                sessions.pop(record['digest'], None)
        elif store:
            store.call('session_revoke', digest=record['digest'])
        else:
            db.session.query(AuthSession).filter_by(token_hash=record['digest']).delete()
            db.session.commit()
        response = jsonify(success=True)
        response.delete_cookie(COOKIES[scope], path='/', secure=secure, httponly=True, samesite='None' if secure else 'Lax')
        return response

    for scope, prefix in [('user', '/api/auth'), ('admin', '/api/admin')]:
        app.add_url_rule(prefix + '/session', scope + '_session', authenticated(scope)(session_response), methods=['GET'])
        def logout_handler(record, scope=scope):
            return logout_response(scope, record)
        app.add_url_rule(prefix + '/logout', scope + '_logout', authenticated(scope)(logout_handler), methods=['POST'])

    @app.get('/api/admin/catalog')
    @authenticated('admin')
    def admin_catalog(record):
        root = Path(__file__).resolve().parent / 'data'
        try:
            def read(name):
                return json.loads((root / name).read_text(encoding='utf-8-sig'))
            return jsonify(success=True, tools=read('published-tools.json'), inventory=read('inventory.json'), stats=read('implementation-status.json'))
        except (OSError, ValueError):
            return failure('Refresh the local tool inventory first.', 503)

    @app.get('/api/admin/health')
    @authenticated('admin')
    def admin_health(record):
        return jsonify(success=True, backend='running', authMode='local-demo' if demo else 'database',
                       sessionType='jwt-cookie', database='disabled' if demo else 'connected',
                       uptimeSeconds=int(time.monotonic() - started))

    app.extensions['site_auth'] = {'authenticated': authenticated, 'current': current}
