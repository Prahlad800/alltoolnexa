"""Private visitor analytics and administrator-managed public availability."""
import hashlib
import calendar
import hmac
import ipaddress
import json
import re
import secrets
import threading
import time
import urllib.request
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Blueprint, jsonify, request
from itsdangerous import BadSignature, URLSafeSerializer, URLSafeTimedSerializer
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from database import db
from models import PageVisit, SiteControl, User

VISITOR_COOKIE = 'alltoolnexa_visitor'
RETENTION_DAYS = 30
DELETE_WINDOWS = {'6h': 'last 6 hours', '1d': 'last 1 day', '1m': 'last 1 month', '6m': 'last 6 months', '1y': 'last 1 year'}


def deletion_start(end, window):
    if window == '6h':
        return end - timedelta(hours=6)
    if window == '1d':
        return end - timedelta(days=1)
    months = {'1m': 1, '6m': 6, '1y': 12}[window]
    month_index = end.year * 12 + end.month - 1 - months
    year, month = divmod(month_index, 12)
    month += 1
    return end.replace(year=year, month=month, day=min(end.day, calendar.monthrange(year, month)[1]))


def init_site_operations(app):
    routes = Blueprint('site_operations', __name__)
    store = app.extensions.get('supabase_store')
    auth = app.extensions['site_auth']
    secret = app.config.get('JWT_SECRET_KEY') or secrets.token_hex(32)
    signer = URLSafeSerializer(secret, salt='site-visitor-v1')
    delete_signer = URLSafeTimedSerializer(secret, salt='visitor-deletion-v1')
    origins = set(app.config['AUTH_ALLOWED_ORIGINS'])
    lock = threading.Lock()
    buckets, geo_cache = {}, {}
    def cleanup():
        if store:
            return store.call('cleanup')['purged']
        now = datetime.now(timezone.utc)
        count = db.session.query(PageVisit).filter(PageVisit.deleted_at <= now-timedelta(days=30)).delete(synchronize_session=False)
        db.session.query(PageVisit).filter(PageVisit.deleted_at.is_(None), func.coalesce(PageVisit.restored_at, PageVisit.started_at) < now-timedelta(days=30)).update({PageVisit.deleted_at:now}, synchronize_session=False)
        db.session.commit()
        return count

    @app.cli.command('purge-analytics-trash')
    def purge_trash_command():
        print(f'Expired trash records purged: {cleanup()}')

    worker_started = [False]
    def maintenance_worker():
        while True:
            with app.app_context():
                try:
                    cleanup()
                except Exception:
                    if 'sqlalchemy' in app.extensions:
                        db.session.rollback()
                    app.logger.warning('Analytics cleanup failed; retrying in one hour.')
                finally:
                    if 'sqlalchemy' in app.extensions:
                        db.session.remove()
            time.sleep(3600)

    @app.before_request
    def start_maintenance():
        if not app.testing and ('sqlalchemy' in app.extensions or store):
            with lock:
                if not worker_started[0]:
                    worker_started[0] = True
                    threading.Thread(target=maintenance_worker, daemon=True, name='analytics-trash-cleanup').start()

    data = Path(__file__).with_name('data')
    catalog = json.loads((data / 'published-tools.json').read_text(encoding='utf-8-sig'))
    category_list = json.loads((data / 'categories.json').read_text(encoding='utf-8-sig'))
    tools = {t['id']: {'id': t['id'], 'name': t['name'], 'category': t['category']} for t in catalog}
    tools['spreadsheet-editor']['name'] = 'DraftSheet / Spreadsheet Editor'
    tools['draftword'] = {'id': 'draftword', 'name': 'DraftWord', 'category': 'office'}
    categories = {c['id']: {'id': c['id'], 'name': c['name']} for c in category_list}

    def fail(message, status):
        return jsonify(success=False, message=message), status

    @routes.before_request
    def boundary():
        origin = request.headers.get('Origin')
        if origin and origin not in origins:
            return fail('Origin is not allowed.', 403)
        if request.method == 'OPTIONS':
            return '', 204
        if request.method == 'POST' and origin not in origins:
            return fail('A trusted application origin is required.', 403)
        if 'sqlalchemy' not in app.extensions and not store:
            return fail('Site operations require configured database storage.', 503)

    @routes.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        origin = request.headers.get('Origin')
        if origin in origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.vary.add('Origin')
        return response

    @routes.errorhandler(SQLAlchemyError)
    def database_error(error):
        if 'sqlalchemy' in app.extensions:
            db.session.rollback()
        return fail('Site data is temporarily unavailable.', 503)

    def limited(scope, limit):
        now = time.monotonic()
        key = (scope, request.remote_addr)
        with lock:
            for old in [k for k, v in buckets.items() if not v or now - v[-1] > 60]:
                del buckets[old]
            if key not in buckets and len(buckets) >= 2000:
                return True
            queue = buckets.setdefault(key, deque())
            while queue and now - queue[0] > 60:
                queue.popleft()
            if len(queue) >= limit:
                return True
            queue.append(now)
        return False

    def geo(ip):
        try:
            address = ipaddress.ip_address(ip)
        except ValueError:
            return {'location_status': 'unavailable'}
        if not address.is_global:
            return {'location_status': 'local'}
        now = time.monotonic()
        with lock:
            cached = geo_cache.get(ip)
        if cached and cached[0] > now:
            return cached[1]
        result = {'location_status': 'unavailable'}
        try:
            query = urllib.request.Request('https://ipwho.is/' + str(address) + '?fields=success,country,region,city', headers={'User-Agent': 'AllToolNexa/1.0'})
            with urllib.request.urlopen(query, timeout=2) as response:
                value = json.loads(response.read(65536))
            if isinstance(value, dict) and value.get('success') is True:
                result = {k: str(value.get(k) or '')[:100] or None for k in ('country', 'region', 'city')}
                result['location_status'] = 'approximate'
        except (OSError, ValueError, TimeoutError):
            pass
        with lock:
            if len(geo_cache) >= 2000:
                geo_cache.clear()
            geo_cache[ip] = (now + (86400 if result['location_status'] == 'approximate' else 3600), result)
        return result

    def visitor():
        value = request.cookies.get(VISITOR_COOKIE, '')
        try:
            nonce = signer.loads(value)
            if not isinstance(nonce, str) or len(nonce) != 64:
                raise BadSignature('Invalid visitor')
        except BadSignature:
            nonce = secrets.token_hex(32)
            value = signer.dumps(nonce)
        digest = hmac.new(secret.encode(), ('visitor:' + nonce).encode(), hashlib.sha256).hexdigest()
        return digest, value

    def public_state():
        if store:
            return store.call('controls')
        rows = db.session.query(SiteControl).filter_by(enabled=False).all()
        return {'disabledTools': [r.key[5:] for r in rows if r.key.startswith('tool:')],
                'disabledCategories': [r.key[9:] for r in rows if r.key.startswith('category:')]}

    @routes.get('/api/public/availability')
    def availability():
        return jsonify(success=True, **public_state())

    @routes.get('/api/admin/controls')
    @auth['authenticated']('admin')
    def controls(record):
        state = public_state()
        return jsonify(success=True, **state, tools=list(tools.values()), categories=list(categories.values()))

    @routes.post('/api/admin/controls')
    @auth['authenticated']('admin')
    def update_control(record):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return fail('Send a control and its enabled state.', 400)
        kind, item, enabled = payload.get('kind'), payload.get('id'), payload.get('enabled')
        source = tools if kind == 'tool' else categories if kind == 'category' else {}
        if not isinstance(item, str) or item not in source or not isinstance(enabled, bool):
            return fail('Unknown tool/category or invalid enabled state.', 400)
        key = kind + ':' + item
        if store:
            store.call('control_update', key=key, enabled=enabled, admin=record['user']['id'])
            return jsonify(success=True, **public_state())
        row = db.session.get(SiteControl, key)
        if not row:
            row = SiteControl(key=key)
            db.session.add(row)
        row.enabled = enabled
        row.updated_by = uuid.UUID(record['user']['id'])
        row.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify(success=True, **public_state())

    @routes.post('/api/analytics/start')
    def start_visit():
        if limited('start', 60):
            return fail('Too many page starts.', 429)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return fail('Send a page path.', 400)
        path = payload.get('path')
        if not isinstance(path, str) or len(path) > 240 or not re.fullmatch(r'/[A-Za-z0-9_/-]*', path):
            return fail('Only a page pathname is accepted, without queries or fragments.', 400)
        digest, cookie = visitor()
        user_session = auth['current']('user')
        ip = request.remote_addr or ''
        agent = request.user_agent.string[:400].lower()
        host = payload.get('referrerHost', '')
        host = host if isinstance(host, str) and re.fullmatch(r'[A-Za-z0-9.-]{0,253}', host) else None
        now = datetime.now(timezone.utc)
        visit = PageVisit(visitor_hash=digest, user_id=uuid.UUID(user_session['user']['id']) if user_session else None,
                          path=path, ip_address=ip, device='tablet' if 'ipad' in agent or 'tablet' in agent else 'mobile' if 'mobile' in agent else 'desktop',
                          referrer_host=host or None, active_seconds=0, started_at=now, last_seen_at=now, **geo(ip))
        if store:
            value = store.call('visit_start', **{k:getattr(visit,k) for k in ('visitor_hash','user_id','path','ip_address','device','referrer_host','country','region','city','location_status')})
            visit.id = uuid.UUID(value['id'])
        else:
            db.session.add(visit)
            db.session.commit()
        response = jsonify(success=True, visitId=str(visit.id))
        response.set_cookie(VISITOR_COOKIE, cookie, max_age=RETENTION_DAYS*86400, path='/api/analytics',
                            httponly=True, secure=app.config['AUTH_COOKIE_SECURE'], samesite='None' if app.config['AUTH_COOKIE_SECURE'] else 'Lax')
        return response, 201

    @routes.post('/api/analytics/heartbeat')
    def heartbeat():
        if limited('heartbeat', 240):
            return fail('Too many activity updates.', 429)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or type(payload.get('activeSeconds')) is not int or not 0 <= payload['activeSeconds'] <= 2592000:
            return fail('Send cumulative active seconds.', 400)
        try:
            visit_id = uuid.UUID(payload.get('visitId', ''))
        except (ValueError, TypeError, AttributeError):
            return fail('Invalid visit identifier.', 400)
        digest, _ = visitor()
        if store:
            value = store.call('heartbeat', id=visit_id, digest=digest, seconds=payload['activeSeconds'])
            return fail(value['error'],value['status']) if value.get('error') else jsonify(success=True)
        visit = db.session.query(PageVisit).filter_by(id=visit_id, deleted_at=None).with_for_update().first()
        if not visit or not hmac.compare_digest(visit.visitor_hash, digest):
            return fail('Visit not found.', 404)
        now = datetime.now(timezone.utc)
        started = visit.started_at.replace(tzinfo=timezone.utc) if visit.started_at.tzinfo is None else visit.started_at
        visit.active_seconds = max(visit.active_seconds, min(payload['activeSeconds'], max(0, int((now-started).total_seconds())) + 2))
        visit.last_seen_at = now
        db.session.commit()
        return jsonify(success=True)

    @routes.get('/api/admin/analytics')
    @auth['authenticated']('admin')
    def analytics(record):
        try:
            days = int(request.args.get('days', '7'))
            page = max(1, int(request.args.get('page', '1')))
            if days not in (1, 7, 30):
                raise ValueError()
        except ValueError:
            return fail('Choose 1, 7 or 30 days and a valid page.', 400)
        selected = request.args.get('visitor', '')
        if selected and not re.fullmatch('[a-f0-9]{64}', selected):
            return fail('Invalid visitor identifier.', 400)
        if store:
            return jsonify(success=True, **store.call('analytics', days=days, page=page, visitor=selected))
        base = db.session.query(PageVisit).filter(PageVisit.deleted_at.is_(None), PageVisit.started_at >= datetime.now(timezone.utc)-timedelta(days=days))
        if selected:
            if not re.fullmatch('[a-f0-9]{64}', selected):
                return fail('Invalid visitor identifier.', 400)
            base = base.filter(PageVisit.visitor_hash == selected)
        views, visitors, seconds = base.with_entities(func.count(PageVisit.id), func.count(func.distinct(PageVisit.visitor_hash)), func.coalesce(func.sum(PageVisit.active_seconds), 0)).one()
        signed_in = base.filter(PageVisit.user_id.is_not(None)).with_entities(func.count(func.distinct(PageVisit.visitor_hash))).scalar()
        pages = base.with_entities(PageVisit.path, func.count(PageVisit.id), func.coalesce(func.sum(PageVisit.active_seconds), 0)).group_by(PageVisit.path).order_by(func.count(PageVisit.id).desc()).limit(30).all()
        rows = base.add_entity(User).outerjoin(User, User.id == PageVisit.user_id).order_by(PageVisit.started_at.desc()).offset((page-1)*50).limit(50).all()
        def iso(value):
            return value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()
        return jsonify(success=True, summary={'pageViews': views, 'visitors': visitors, 'activeSeconds': seconds, 'signedInVisitors': signed_in},
                       pages=[{'path': p, 'views': n, 'activeSeconds': s} for p, n, s in pages],
                       visits=[{'id': str(v.id), 'visitorId': v.visitor_hash, 'email': u.email if u else None, 'path': v.path,
                                'ip': v.ip_address, 'country': v.country, 'region': v.region, 'city': v.city, 'locationStatus': v.location_status,
                                'device': v.device, 'activeSeconds': v.active_seconds, 'startedAt': iso(v.started_at), 'lastSeenAt': iso(v.last_seen_at)} for v, u in rows],
                       pagination={'page': page, 'hasMore': page*50 < views}, retentionDays=RETENTION_DAYS)

    def deletion_query(begin, end, selected):
        query = db.session.query(PageVisit).filter(PageVisit.deleted_at.is_(None), PageVisit.started_at >= begin, PageVisit.started_at <= end)
        if selected:
            query = query.filter(PageVisit.visitor_hash == selected)
        return query

    @routes.post('/api/admin/analytics/delete-preview')
    @auth['authenticated']('admin')
    def deletion_preview(record):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return fail('Choose a deletion period.', 400)
        window, selected = payload.get('range'), payload.get('visitor', '')
        if not isinstance(window, str) or window not in DELETE_WINDOWS or not isinstance(selected, str) or (selected and not re.fullmatch('[a-f0-9]{64}', selected)):
            return fail('Choose 6 hours, 1 day, 1 month, 6 months or 1 year.', 400)
        end = datetime.now(timezone.utc)
        begin = deletion_start(end, window)
        count = store.call('delete_preview', begin=begin, end=end, visitor=selected)['count'] if store else deletion_query(begin, end, selected).count()
        token = delete_signer.dumps({'admin': record['user']['id'], 'range': window, 'visitor': selected, 'from': begin.isoformat(), 'to': end.isoformat()})
        return jsonify(success=True, count=count, range=window, label=DELETE_WINDOWS[window],
                       visitor=selected, start=begin.isoformat(), end=end.isoformat(), confirmationToken=token)

    @routes.post('/api/admin/analytics/delete')
    @auth['authenticated']('admin')
    def delete_visits(record):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get('confirmationToken'), str):
            return fail('Preview the deletion before confirming.', 400)
        try:
            value = delete_signer.loads(payload['confirmationToken'], max_age=300)
            if value['admin'] != record['user']['id'] or value['range'] not in DELETE_WINDOWS:
                raise ValueError()
            begin, end = datetime.fromisoformat(value['from']), datetime.fromisoformat(value['to'])
            selected = value['visitor']
            if begin.tzinfo is None or end.tzinfo is None or deletion_start(end, value['range']) != begin or (selected and not re.fullmatch('[a-f0-9]{64}', selected)):
                raise ValueError()
        except (BadSignature, ValueError, KeyError, TypeError):
            return fail('Deletion preview expired or is invalid. Close it and preview again.', 400)
        if store:
            count = store.call('visits_delete', begin=begin, end=end, visitor=selected)['count']
        else:
            count = deletion_query(begin, end, selected).update({PageVisit.deleted_at: datetime.now(timezone.utc)}, synchronize_session=False)
            db.session.commit()
        app.logger.info('Analytics deletion: rows=%s range=%s admin=%s', count, value['range'], record['user']['id'])
        return jsonify(success=True, deleted=count, movedToTrash=count, trashDays=30)

    @routes.get('/api/admin/analytics/trash')
    @auth['authenticated']('admin')
    def trash(record):
        try:
            page = max(1, int(request.args.get('page', '1')))
        except ValueError:
            return fail('Invalid page.', 400)
        if store:
            return jsonify(success=True, **store.call('trash', page=page))
        now = datetime.now(timezone.utc)
        base = db.session.query(PageVisit).filter(PageVisit.deleted_at > now-timedelta(days=30))
        count = base.count()
        rows = base.order_by(PageVisit.deleted_at.desc(), PageVisit.id).offset((page-1)*50).limit(50).all()
        def utc(value):
            return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
        return jsonify(success=True, count=count, visits=[{'id':str(v.id), 'path':v.path, 'visitorId':v.visitor_hash, 'deletedAt':utc(v.deleted_at).isoformat(), 'expiresAt':(utc(v.deleted_at)+timedelta(days=30)).isoformat()} for v in rows], pagination={'page':page, 'hasMore':page*50<count})

    @routes.post('/api/admin/analytics/trash/restore')
    @auth['authenticated']('admin')
    def restore(record):
        payload = request.get_json(silent=True)
        try:
            visit_id = uuid.UUID(payload.get('id', ''))
        except (ValueError, TypeError, AttributeError):
            return fail('Invalid visit identifier.', 400)
        if store:
            count = store.call('restore', id=visit_id)['count']
            return jsonify(success=True, restored=count) if count else fail('Trash record expired or was already restored.',404)
        now = datetime.now(timezone.utc)
        count = db.session.query(PageVisit).filter(PageVisit.id == visit_id, PageVisit.deleted_at > now-timedelta(days=30)).update({PageVisit.deleted_at:None, PageVisit.restored_at:now}, synchronize_session=False)
        if not count:
            return fail('Trash record expired or was already restored.', 404)
        db.session.commit()
        return jsonify(success=True, restored=count)

    app.register_blueprint(routes)
