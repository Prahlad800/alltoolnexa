"""Restricted backend RPC for Supabase HTTPS transport."""
from pathlib import Path
from alembic import op
revision = '0007_supabase_https'
down_revision = '0006_billing'
branch_labels = depends_on = None

def upgrade():
    op.execute(Path(__file__).parents[1].joinpath('supabase_backend.sql').read_text(encoding='utf-8'))

def downgrade():
    op.execute('DROP FUNCTION IF EXISTS public.alltoolnexa_backend(text,jsonb)')
