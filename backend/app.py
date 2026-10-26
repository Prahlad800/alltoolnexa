import os
from pathlib import Path

import click
from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from flask import Flask, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import db, database_options


def create_app(config=None):
    load_dotenv(Path(__file__).with_name('.env'))
    app = Flask(__name__)
    mode = (config or {}).get('AUTH_MODE', os.getenv('AUTH_MODE', 'database'))
    app.config.update(
        AUTH_MODE=mode,
        DEPLOYMENT_REVISION=os.getenv('DEPLOYMENT_REVISION', ''),
        DEMO_ADMIN_USERNAME=os.getenv('DEMO_ADMIN_USERNAME', 'admin'),
        DEMO_ADMIN_EMAIL=os.getenv('DEMO_ADMIN_EMAIL', 'admin@alltoolnexa.local'),
        DEMO_ADMIN_PASSWORD=os.getenv('DEMO_ADMIN_PASSWORD', ''),
        JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', ''),
        TRUSTED_PROXY_HOPS=int(os.getenv('TRUSTED_PROXY_HOPS', '0')),
        AUTH_COOKIE_SECURE=os.getenv('AUTH_COOKIE_SECURE', 'false' if mode == 'demo' else 'true').lower() == 'true',
        AUTH_ALLOWED_ORIGINS=[s.strip() for s in os.getenv('AUTH_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001').split(',') if s.strip()],
        DEMO_ALLOWED_ORIGINS=['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    if mode != 'demo':
        app.config.update(database_options(os.getenv('DATABASE_URL', '')))
    if config:
        app.config.update(config)
    if app.config['TRUSTED_PROXY_HOPS']:
        from werkzeug.middleware.proxy_fix import ProxyFix
        hops = app.config['TRUSTED_PROXY_HOPS']
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops, x_host=0, x_port=0, x_prefix=0)
    if app.config.get('SQLALCHEMY_DATABASE_URI'):
        db.init_app(app)
    if (config or {}).get('DATABASE_TRANSPORT', os.getenv('DATABASE_TRANSPORT', 'postgres')) == 'supabase':
        from supabase_store import SupabaseStore
        app.extensions['supabase_store'] = SupabaseStore(
            os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL', ''),
            os.getenv('SUPABASE_SECRET_KEY', ''))
    import models  # Register metadata without creating tables at startup.
    from jwt_auth import init_auth
    init_auth(app)
    from site_operations import init_site_operations
    init_site_operations(app)
    from user_storage import init_user_storage
    init_user_storage(app)
    from billing import init_billing
    init_billing(app)

    @app.get('/')
    def home():
        return jsonify(message='AllToolNexa Flask API is running')

    @app.get('/api/health')
    def health():
        return jsonify(success=True, message='Backend is working', authMode=app.config['AUTH_MODE'], databaseRequired=app.config['AUTH_MODE'] != 'demo', revision=app.config['DEPLOYMENT_REVISION'])

    @app.get('/api/health/database')
    def database_health():
        if app.config['AUTH_MODE'] == 'demo':
            return jsonify(success=True, database='disabled_demo', required=False)
        if 'supabase_store' in app.extensions:
            try:
                app.extensions['supabase_store'].call('ping')
                return jsonify(success=True, database='connected', transport='supabase-https')
            except SQLAlchemyError:
                return jsonify(success=False, database='unavailable'), 503
        if not app.config.get('SQLALCHEMY_DATABASE_URI'):
            return jsonify(success=False, database='not_configured'), 503
        try:
            db.session.execute(text('SELECT 1'))
            return jsonify(success=True, database='connected')
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify(success=False, database='unavailable'), 503

    @app.cli.command('db-upgrade')
    def db_upgrade():
        """Apply versioned authentication schema migrations."""
        if not app.config.get('SQLALCHEMY_DATABASE_URI'):
            raise click.ClickException('Set DATABASE_URL in backend/.env first.')
        migration_config = Config()
        migration_config.set_main_option('script_location', str(Path(__file__).with_name('migrations')))
        try:
            with db.engine.connect() as connection:
                migration_config.attributes['connection'] = connection
                command.upgrade(migration_config, 'head')
        except SQLAlchemyError:
            raise click.ClickException('Migration failed. Check credentials, network and database permissions.') from None
        click.echo('Authentication database migrations applied.')

    @app.cli.command('db-check')
    def db_check():
        """Check connectivity and authentication tables without changing data."""
        if not app.config.get('SQLALCHEMY_DATABASE_URI'):
            raise click.ClickException('Set DATABASE_URL in backend/.env first.')
        try:
            for table in ('users', 'auth_sessions'):
                db.session.execute(text(f'SELECT id FROM alltoolnexa_private.{table} LIMIT 0'))
        except SQLAlchemyError:
            db.session.rollback()
            raise click.ClickException('Database check failed. Check credentials, network and migrations.') from None
        click.echo('Database connected; authentication tables are ready.')

    @app.cli.command('create-admin')
    @click.option('--email', prompt=True)
    @click.option('--username', default='admin', show_default=True)
    @click.password_option()
    def create_admin(email, username, password):
        """Create an administrator through the trusted server console only."""
        import re
        from models import User
        if not app.config.get('SQLALCHEMY_DATABASE_URI'):
            raise click.ClickException('Set DATABASE_URL and apply migrations first.')
        email = email.strip().lower()
        username = username.strip().lower()
        if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            raise click.ClickException('Enter a valid email address.')
        if not re.fullmatch(r'[a-z0-9_.-]{3,40}', username):
            raise click.ClickException('Username must be 3 to 40 letters, digits, dots, underscores or hyphens.')
        try:
            if db.session.query(User).filter((User.email == email) | (User.username == username)).first():
                raise click.ClickException('This email or username already exists. No account was changed.')
            user = User(email=email, username=username, role='admin')
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
        except ValueError as error:
            db.session.rollback()
            raise click.ClickException(str(error)) from None
        except SQLAlchemyError:
            db.session.rollback()
            raise click.ClickException('Could not create the administrator. Check database connectivity and migrations.') from None
        click.echo('Administrator created. Sign in from the admin application using the email address.')

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=5000)
