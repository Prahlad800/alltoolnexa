"""Restorable visitor trash."""
from alembic import op
import sqlalchemy as sa
revision = '0004_analytics_trash'
down_revision = '0003_site_operations'
branch_labels = None
depends_on = None
SCHEMA = 'alltoolnexa_private'
def upgrade():
    for name in ('deleted_at', 'restored_at'):
        op.add_column('page_visits', sa.Column(name, sa.DateTime(timezone=True)), schema=SCHEMA)
    op.create_index('ix_page_visits_deleted_at', 'page_visits', ['deleted_at'], schema=SCHEMA)
def downgrade():
    op.drop_index('ix_page_visits_deleted_at', table_name='page_visits', schema=SCHEMA)
    for name in ('restored_at', 'deleted_at'):
        op.drop_column('page_visits', name, schema=SCHEMA)
