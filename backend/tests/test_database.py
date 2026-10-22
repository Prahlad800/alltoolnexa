import importlib.util
import io
import os
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError, OperationalError

from app import create_app
from database import db, database_options
from models import AuthSession, User


class ConfigurationTests(unittest.TestCase):
    def test_supabase_url_and_ssl(self):
        options = database_options('postgres://postgres.ref:secret@pooler.example:5432/postgres')
        url = options['SQLALCHEMY_DATABASE_URI']
        self.assertEqual(url.drivername, 'postgresql+psycopg')
        self.assertEqual(url.query['sslmode'], 'require')

    def test_unsafe_or_unsupported_urls_rejected(self):
        for url in ('sqlite:///test.db', 'postgres://u:p@host:6543/db',
                    'postgres://u:p@host/db?sslmode=disable'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                database_options(url)

    @patch.dict(os.environ, {'DATABASE_URL': ''})
    def test_unconfigured_backend_still_runs(self):
        app = create_app({'TESTING': True, 'AUTH_MODE': 'database'})
        client = app.test_client()
        self.assertEqual(client.get('/api/health').status_code, 200)
        response = client.get('/api/health/database')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json['database'], 'not_configured')
        result = app.test_cli_runner().invoke(args=['db-upgrade'])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn('Set DATABASE_URL', result.output)

    def test_migration_generates_private_postgres_schema(self):
        output = io.StringIO()
        ctx = MigrationContext.configure(dialect_name='postgresql', opts={'as_sql': True, 'output_buffer': output})
        path = Path(__file__).resolve().parents[1] / 'migrations/versions/0001_auth.py'
        spec = importlib.util.spec_from_file_location('initial_auth', path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with Operations.context(ctx):
            migration.upgrade()
        sql = output.getvalue()
        self.assertIn('CREATE TABLE alltoolnexa_private.users', sql)
        self.assertEqual(sql.count('ENABLE ROW LEVEL SECURITY'), 2)
        self.assertIn('FROM PUBLIC, anon, authenticated', sql)
        self.assertIn('ON DELETE CASCADE', sql)


class ModelTests(unittest.TestCase):
    def setUp(self):
        with patch.dict(os.environ, {'DATABASE_URL': ''}):
            self.app = create_app({
                'TESTING': True,
                'AUTH_MODE': 'database',
                'SQLALCHEMY_DATABASE_URI': 'sqlite://',
                'SQLALCHEMY_ENGINE_OPTIONS': {},
            })
        self.context = self.app.app_context()
        self.context.push()

        @event.listens_for(db.engine, 'connect')
        def attach_schema(connection, record):
            connection.execute("ATTACH DATABASE ':memory:' AS alltoolnexa_private")
            connection.execute('PRAGMA foreign_keys=ON')

        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.engine.dispose()
        self.context.pop()

    def user(self):
        user = User(email='member@example.com')
        user.set_password('a-long-test-password')
        db.session.add(user)
        db.session.commit()
        return user

    def test_password_hash_and_role_default(self):
        user = self.user()
        self.assertNotEqual(user.password_hash, 'a-long-test-password')
        self.assertTrue(user.check_password('a-long-test-password'))
        self.assertFalse(user.check_password('wrong-password'))
        self.assertEqual(user.role, 'user')

    def test_duplicate_and_unnormalized_email_rejected(self):
        self.user()
        for email in ('member@example.com', 'Upper@Example.com'):
            db.session.add(User(email=email, password_hash='test'))
            with self.assertRaises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_delete_user_cascades_sessions(self):
        user = self.user()
        now = datetime.now(timezone.utc)
        db.session.add(AuthSession(user_id=user.id, token_hash='a' * 64,
                                  created_at=now, expires_at=now + timedelta(hours=1)))
        db.session.commit()
        db.session.delete(user)
        db.session.commit()
        self.assertEqual(db.session.query(AuthSession).count(), 0)

    def test_database_error_does_not_leak_details(self):
        with patch.object(db.session, 'execute', side_effect=OperationalError('secret', {}, Exception('password'))):
            response = self.app.test_client().get('/api/health/database')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {'success': False, 'database': 'unavailable'})


if __name__ == '__main__':
    unittest.main()
