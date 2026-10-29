"""Retain latest login time and expose private user listings over HTTPS."""
from pathlib import Path
from alembic import op
import sqlalchemy as sa
revision = '0009_user_last_login'
down_revision = '0008_annual_billing'
branch_labels = depends_on = None

def upgrade():
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True), schema='alltoolnexa_private')
    op.execute('UPDATE alltoolnexa_private.users u SET last_login_at = s.latest FROM (SELECT user_id, max(created_at) latest FROM alltoolnexa_private.auth_sessions GROUP BY user_id) s WHERE u.id = s.user_id')
    op.execute(Path(__file__).parents[1].joinpath('supabase_backend.sql').read_text(encoding='utf-8'))

def downgrade():
    # Preserve recorded login history and the compatible RPC on rollback.
    pass
