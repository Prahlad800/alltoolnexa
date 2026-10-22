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
        DEMO_ADMIN_USERNAME=os.getenv('DEMO_ADMIN_USERNAME', 'admin'),
        DEMO_ADMIN_EMAIL=os.getenv('DEMO_ADMIN_EMAIL', 'admin@alltoolnexa.local'),
        DEMO_ADMIN_PASSWORD=os.getenv('DEMO_ADMIN_PASSWORD', ''),
        DEMO_ALLOWED_ORIGINS=['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    if mode != 'demo':
        app.config.update(database_options(os.getenv('DATABASE_URL', '')))
    if config:
        app.config.update(config)
    if app.config.get('SQLALCHEMY_DATABASE_URI'):
        db.init_app(app)
    import models  # Register metadata without creating tables at startup.
    from demo_auth import init_demo_auth
    init_demo_auth(app)

    @app.get('/')
    def home():
        return jsonify(message='AllToolNexa Flask API is running')

    @app.get('/api/health')
    def health():
        return jsonify(success=True, message='Backend is working', authMode=app.config['AUTH_MODE'], databaseRequired=app.config['AUTH_MODE'] != 'demo')

    @app.get('/api/health/database')
    def database_health():
        if app.config['AUTH_MODE'] == 'demo':
            return jsonify(success=True, database='disabled_demo', required=False)
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

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=5000)
