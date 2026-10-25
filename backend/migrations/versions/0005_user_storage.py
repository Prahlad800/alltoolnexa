"""Private per-user Free-plan file storage."""
from alembic import op
import sqlalchemy as sa
revision = '0005_user_storage'
down_revision = '0004_analytics_trash'
branch_labels = None
depends_on = None
SCHEMA = 'alltoolnexa_private'
def upgrade():
    op.create_table('user_files',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey(SCHEMA+'.users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('content', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('size_bytes > 0 AND size_bytes <= 2000000', name='ck_file_size'), schema=SCHEMA)
    op.create_index('ix_user_files_user_id', 'user_files', ['user_id'], schema=SCHEMA)
    op.execute(f'ALTER TABLE {SCHEMA}.user_files ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE {SCHEMA}.user_files FROM PUBLIC, anon, authenticated')
def downgrade():
    op.drop_table('user_files', schema=SCHEMA)
