"""Private availability controls and first-party visitor activity."""
from alembic import op
import sqlalchemy as sa

revision = '0003_site_operations'
down_revision = '0002_admin_username'
branch_labels = None
depends_on = None
SCHEMA = 'alltoolnexa_private'


def upgrade():
    op.create_table('site_controls',
        sa.Column('key', sa.String(140), primary_key=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by', sa.Uuid(), sa.ForeignKey(SCHEMA+'.users.id', ondelete='SET NULL')),
        schema=SCHEMA)
    op.create_table('page_visits',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('visitor_hash', sa.String(64), nullable=False),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey(SCHEMA+'.users.id', ondelete='SET NULL')),
        sa.Column('path', sa.String(240), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('country', sa.String(100)), sa.Column('region', sa.String(100)), sa.Column('city', sa.String(100)),
        sa.Column('location_status', sa.String(20), nullable=False),
        sa.Column('device', sa.String(20), nullable=False), sa.Column('referrer_host', sa.String(253)),
        sa.Column('active_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('active_seconds >= 0', name='ck_visit_seconds'), schema=SCHEMA)
    for column in ('visitor_hash', 'path', 'started_at'):
        op.create_index('ix_page_visits_'+column, 'page_visits', [column], schema=SCHEMA)
    for table in ('site_controls', 'page_visits'):
        op.execute(f'ALTER TABLE {SCHEMA}.{table} ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE {SCHEMA}.{table} FROM PUBLIC, anon, authenticated')


def downgrade():
    op.drop_table('page_visits', schema=SCHEMA)
    op.drop_table('site_controls', schema=SCHEMA)
