"""Add an optional unique username for administrator sign-in."""
from alembic import op
import sqlalchemy as sa

revision = '0002_admin_username'
down_revision = '0001_auth'
branch_labels = None
depends_on = None
SCHEMA = 'alltoolnexa_private'


def upgrade():
    op.add_column('users', sa.Column('username', sa.String(40), nullable=True), schema=SCHEMA)
    op.create_unique_constraint('uq_users_username', 'users', ['username'], schema=SCHEMA)
    op.create_check_constraint('ck_users_username_normalized', 'users', 'username IS NULL OR username = lower(trim(username))', schema=SCHEMA)


def downgrade():
    op.drop_constraint('ck_users_username_normalized', 'users', type_='check', schema=SCHEMA)
    op.drop_constraint('uq_users_username', 'users', type_='unique', schema=SCHEMA)
    op.drop_column('users', 'username', schema=SCHEMA)
