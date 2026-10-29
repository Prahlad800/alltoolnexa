import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from database import db
from models import AuthSession, PageVisit, SiteControl, User
from site_operations import deletion_start
import test_jwt_auth as auth_tests
PASSWORD, ORIGIN, ADMIN_ORIGIN = auth_tests.PASSWORD, auth_tests.ORIGIN, auth_tests.ADMIN_ORIGIN


class SiteOperationsTests(unittest.TestCase):
    setUp = auth_tests.JWTDatabaseTests.setUp
    tearDown = auth_tests.JWTDatabaseTests.tearDown

    def admin(self):
        user = User(email='ops@example.com', username='ops-admin', role='admin')
        user.set_password(PASSWORD)
        db.session.add(user)
        db.session.commit()
        result = self.client.post('/api/admin/login', json={'username': 'ops-admin', 'password': PASSWORD}, headers=ADMIN_ORIGIN)
        self.assertEqual(result.status_code, 200)
        return {**ADMIN_ORIGIN, 'X-CSRF-Token': result.json['csrfToken']}

    def test_controls_authorization_validation_and_persistence(self):
        self.assertEqual(self.client.get('/api/admin/controls').status_code, 401)
        headers = self.admin()
        self.assertEqual(self.client.post('/api/admin/controls', json={'kind': 'tool', 'id': 'percentage-calculator', 'enabled': False}, headers=ADMIN_ORIGIN).status_code, 403)
        for value in [{'kind': 'tool', 'id': 'not-a-tool', 'enabled': False}, {'kind': 'tool', 'id': 'percentage-calculator', 'enabled': 'false'}]:
            self.assertEqual(self.client.post('/api/admin/controls', json=value, headers=headers).status_code, 400)
        result = self.client.post('/api/admin/controls', json={'kind': 'tool', 'id': 'percentage-calculator', 'enabled': False}, headers=headers)
        self.assertEqual(result.status_code, 200)
        self.assertIn('percentage-calculator', self.client.get('/api/public/availability').json['disabledTools'])
        self.client.post('/api/admin/controls', json={'kind': 'category', 'id': 'math', 'enabled': False}, headers=headers)
        self.assertIn('math', self.client.get('/api/public/availability').json['disabledCategories'])
        self.client.post('/api/admin/controls', json={'kind': 'tool', 'id': 'percentage-calculator', 'enabled': True}, headers=headers)
        self.assertNotIn('percentage-calculator', self.client.get('/api/public/availability').json['disabledTools'])
        self.assertIn('math', self.client.get('/api/public/availability').json['disabledCategories'])

    def test_hierarchy_counts_parent_controls_and_child_preservation(self):
        tree = self.client.get('/api/public/categories').json['mainCategories']
        self.assertEqual([g['toolCount'] for g in tree], [68, 97, 86, 120, 136])
        self.assertEqual(sum(len(g['subcategories']) for g in tree), 18)
        headers = self.admin()
        controls = self.client.get('/api/admin/controls').json
        self.assertEqual(len(controls['mainCategories']), 5)
        self.assertEqual(len(controls['categories']), 18)
        for id in ['pdf-image', 'pdf']:
            result = self.client.post('/api/admin/controls', json={'kind':'category','id':id,'enabled':False}, headers=headers)
            self.assertEqual(result.status_code, 200)
        self.client.post('/api/admin/controls', json={'kind':'category','id':'pdf-image','enabled':True}, headers=headers)
        state = self.client.get('/api/public/availability').json
        self.assertIn('pdf', state['disabledCategories'])
        self.assertNotIn('pdf-image', state['disabledCategories'])

    def test_recent_users_private_login_persists_after_logout(self):
        self.assertEqual(self.client.get('/api/admin/users').status_code, 401)
        signup = self.client.post('/api/auth/signup', json={'email':'recent@example.com','password':PASSWORD}, headers=ORIGIN)
        user = db.session.query(User).filter_by(email='recent@example.com').one()
        self.assertIsNotNone(user.last_login_at)
        self.client.post('/api/auth/logout', json={}, headers={**ORIGIN,'X-CSRF-Token':signup.json['csrfToken']})
        self.admin()
        report = self.client.get('/api/admin/users?sort=login').json
        self.assertEqual(report['total'], 1)
        self.assertEqual(report['users'][0]['email'], 'recent@example.com')
        self.assertIsNotNone(report['users'][0]['lastLoginAt'])
        self.assertNotIn('password', json.dumps(report))
        self.assertEqual(self.client.get('/api/admin/users?sort=bad').status_code, 400)

    def test_guest_page_time_idempotence_cookie_ownership_and_private_ip(self):
        self.assertEqual(self.client.post('/api/analytics/start', json={'path': '/login?password=secret'}, headers=ORIGIN).status_code, 400)
        self.assertEqual(self.client.post('/api/analytics/start', json={'path': '/'}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        with patch('site_operations.urllib.request.urlopen') as lookup:
            result = self.client.post('/api/analytics/start', json={'path': '/about'}, headers={**ORIGIN, 'X-Forwarded-For': '8.8.8.8'})
            lookup.assert_not_called()
        self.assertEqual(result.status_code, 201)
        visit = db.session.query(PageVisit).one()
        self.assertEqual(visit.ip_address, '127.0.0.1')
        self.assertEqual(visit.location_status, 'local')
        self.assertIsNone(visit.user_id)
        visit.started_at -= timedelta(seconds=40)
        db.session.commit()
        payload = {'visitId': result.json['visitId'], 'activeSeconds': 12}
        for _ in range(2):
            self.assertEqual(self.client.post('/api/analytics/heartbeat', json=payload, headers=ORIGIN).status_code, 200)
        self.assertEqual(db.session.query(PageVisit).one().active_seconds, 12)
        other = self.app.test_client()
        self.assertEqual(other.post('/api/analytics/heartbeat', json=payload, headers=ORIGIN).status_code, 404)
        payload['activeSeconds'] = 100000
        self.client.post('/api/analytics/heartbeat', json=payload, headers=ORIGIN)
        self.assertLess(db.session.query(PageVisit).one().active_seconds, 50)

    def test_signed_in_visit_and_private_admin_report(self):
        signup = self.client.post('/api/auth/signup', json={'email': 'visit@example.com', 'password': PASSWORD}, headers=ORIGIN)
        self.assertEqual(signup.status_code, 201)
        self.client.post('/api/analytics/start', json={'path': '/tools/percentage-calculator'}, headers=ORIGIN)
        self.assertEqual(self.client.get('/api/admin/analytics').status_code, 401)
        self.admin()
        report = self.client.get('/api/admin/analytics').json
        self.assertEqual(report['summary']['pageViews'], 1)
        self.assertEqual(report['summary']['signedInVisitors'], 1)
        self.assertEqual(report['visits'][0]['email'], 'visit@example.com')
        self.assertEqual(report['visits'][0]['path'], '/tools/percentage-calculator')
        self.assertNotIn('password', json.dumps(report))

    def test_public_ip_lookup_and_failure_are_honest(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({'success': True, 'country': 'Test country', 'region': 'Test region', 'city': 'Test city'}).encode()
        with patch('site_operations.urllib.request.urlopen', return_value=response):
            result = self.client.post('/api/analytics/start', json={'path': '/'}, headers=ORIGIN, environ_base={'REMOTE_ADDR': '8.8.8.8'})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(db.session.query(PageVisit).one().location_status, 'approximate')
        with patch('site_operations.urllib.request.urlopen', side_effect=OSError('Unavailable')):
            self.client.post('/api/analytics/start', json={'path': '/tools'}, headers=ORIGIN, environ_base={'REMOTE_ADDR': '1.1.1.1'})
        unknown = db.session.query(PageVisit).filter_by(ip_address='1.1.1.1').one()
        self.assertEqual(unknown.location_status, 'unavailable')
        self.assertIsNone(unknown.city)

    def add_visit(self, when, visitor='a'*64):
        visit = PageVisit(visitor_hash=visitor, path='/about', ip_address='127.0.0.1', location_status='local',
                          device='desktop', started_at=when, last_seen_at=when, active_seconds=5)
        db.session.add(visit)
        db.session.commit()
        return visit

    def test_delete_ranges_remove_only_matching_visits(self):
        headers = self.admin()
        now = datetime.now(timezone.utc)
        for age in [timedelta(hours=1), timedelta(hours=8), timedelta(days=2), timedelta(days=40), timedelta(days=200), timedelta(days=400)]:
            self.add_visit(now-age)
        db.session.add(SiteControl(key='tool:percentage-calculator', enabled=False))
        db.session.commit()
        for window in ['6h', '1d', '1m', '6m', '1y']:
            preview = self.client.post('/api/admin/analytics/delete-preview', json={'range': window}, headers=headers)
            self.assertEqual(preview.status_code, 200)
            self.assertEqual(preview.json['count'], 1)
            result = self.client.post('/api/admin/analytics/delete', json={'confirmationToken': preview.json['confirmationToken']}, headers=headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json['deleted'], 1)
        self.assertEqual(db.session.query(PageVisit).filter_by(deleted_at=None).count(), 1)
        self.assertEqual(db.session.query(PageVisit).count(), 6)
        self.assertEqual(db.session.query(User).count(), 1)
        self.assertEqual(db.session.query(AuthSession).count(), 1)
        self.assertFalse(db.session.get(SiteControl, 'tool:percentage-calculator').enabled)

    def test_deletion_scopes_fixed_preview_and_confirmation_validation(self):
        headers = self.admin()
        now = datetime.now(timezone.utc)
        self.add_visit(now-timedelta(hours=1), 'a'*64)
        self.add_visit(now-timedelta(hours=1), 'b'*64)
        self.assertEqual(self.client.post('/api/admin/analytics/delete-preview', json={'range': 'all'}, headers=headers).status_code, 400)
        self.assertEqual(self.client.post('/api/admin/analytics/delete-preview', json={'range': '6h'}, headers=ADMIN_ORIGIN).status_code, 403)
        preview = self.client.post('/api/admin/analytics/delete-preview', json={'range': '6h', 'visitor': 'a'*64}, headers=headers).json
        self.assertEqual(preview['count'], 1)
        later = self.add_visit(datetime.fromisoformat(preview['end'])+timedelta(seconds=1), 'a'*64)
        later_id = later.id
        self.assertEqual(self.client.post('/api/admin/analytics/delete', json={'confirmationToken': preview['confirmationToken']+'bad'}, headers=headers).status_code, 400)
        self.assertEqual(self.client.post('/api/admin/analytics/delete', json={}, headers=headers).status_code, 400)
        result = self.client.post('/api/admin/analytics/delete', json={'confirmationToken': preview['confirmationToken']}, headers=headers)
        self.assertEqual(result.json['deleted'], 1)
        self.assertIsNotNone(db.session.get(PageVisit, later_id))
        self.assertEqual(db.session.query(PageVisit).filter_by(visitor_hash='b'*64).count(), 1)

    def test_calendar_month_and_leap_year_windows(self):
        march = datetime(2024,3,31,12,0,tzinfo=timezone.utc)
        self.assertEqual(deletion_start(march,'1m'), datetime(2024,2,29,12,0,tzinfo=timezone.utc))
        leap = datetime(2024,2,29,12,0,tzinfo=timezone.utc)
        self.assertEqual(deletion_start(leap,'1y'), datetime(2023,2,28,12,0,tzinfo=timezone.utc))

    def test_trash_restore_expiry_and_cleanup(self):
        self.assertEqual(self.client.get('/api/admin/analytics/trash').status_code, 401)
        headers = self.admin()
        now = datetime.now(timezone.utc)
        fresh = self.add_visit(now-timedelta(hours=1))
        expired = self.add_visit(now-timedelta(days=50))
        old = self.add_visit(now-timedelta(days=40))
        fresh.deleted_at = now-timedelta(days=29)
        expired.deleted_at = now-timedelta(days=31)
        db.session.commit()
        fresh_id, expired_id, old_id = fresh.id, expired.id, old.id
        listing = self.client.get('/api/admin/analytics/trash').json
        self.assertEqual(listing['count'], 1)
        self.assertEqual(self.client.get('/api/admin/analytics').json['summary']['pageViews'], 0)
        self.assertEqual(self.client.post('/api/admin/analytics/trash/restore', json={'id':str(fresh_id)}, headers=ADMIN_ORIGIN).status_code, 403)
        self.assertEqual(self.client.post('/api/admin/analytics/trash/restore', json={'id':str(expired_id)}, headers=headers).status_code, 404)
        self.assertEqual(self.client.post('/api/admin/analytics/trash/restore', json={'id':str(fresh_id)}, headers=headers).status_code, 200)
        self.assertEqual(self.client.post('/api/admin/analytics/trash/restore', json={'id':str(fresh_id)}, headers=headers).status_code, 404)
        result = self.app.test_cli_runner().invoke(args=['purge-analytics-trash'])
        self.assertEqual(result.exit_code, 0, result.output)
        db.session.expire_all()
        self.assertIsNone(db.session.get(PageVisit, expired_id))
        self.assertIsNone(db.session.get(PageVisit, fresh_id).deleted_at)
        self.assertIsNotNone(db.session.get(PageVisit, old_id).deleted_at)
        self.assertEqual(self.client.get('/api/admin/analytics').json['summary']['pageViews'], 1)
