"""Enable twelve-month annual activation in the backwards-compatible HTTPS RPC."""
from pathlib import Path
from alembic import op
revision = '0008_annual_billing'
down_revision = '0007_supabase_https'
branch_labels = depends_on = None


def upgrade():
    op.execute(Path(__file__).parents[1].joinpath('supabase_backend.sql').read_text(encoding='utf-8'))


def downgrade():
    # No schema columns were added. Retain the compatible RPC to correctly honour
    # already-created annual orders even if the application is rolled back.
    pass
