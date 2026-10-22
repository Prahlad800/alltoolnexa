"""Minimal private authentication data; no tool inputs or results."""
from alembic import op
import sqlalchemy as sa

revision = '0001_auth'
down_revision = None
branch_labels = None
depends_on = None
SCHEMA = 'alltoolnexa_private'


def upgrade():
    op.execute(f'CREATE SCHEMA IF NOT EXISTS {SCHEMA}')
    op.execute(f'REVOKE ALL ON SCHEMA {SCHEMA} FROM PUBLIC, anon, authenticated')
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False, primary_key=True),
        sa.Column('email', sa.String(254), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.String(16), nullable=False, server_default='user'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('email', name='uq_users_email'),
        sa.CheckConstraint('email = lower(trim(email))', name='ck_users_email_normalized'),
        sa.CheckConstraint("role IN ('user', 'admin')", name='ck_users_role'),
        schema=SCHEMA,
    )
    op.create_table(
        'auth_sessions',
        sa.Column('id', sa.Uuid(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey(f'{SCHEMA}.users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('length(token_hash) = 64', name='ck_sessions_hash_length'),
        sa.CheckConstraint('expires_at > created_at', name='ck_sessions_expiry'),
        schema=SCHEMA,
    )
    op.create_index('ix_auth_sessions_user_id', 'auth_sessions', ['user_id'], schema=SCHEMA)
    op.create_index('ix_auth_sessions_expires_at', 'auth_sessions', ['expires_at'], schema=SCHEMA)
    for table in ('users', 'auth_sessions'):
        op.execute(f'ALTER TABLE {SCHEMA}.{table} ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE {SCHEMA}.{table} FROM PUBLIC, anon, authenticated')


def downgrade():
    op.drop_table('auth_sessions', schema=SCHEMA)
    op.drop_table('users', schema=SCHEMA)
