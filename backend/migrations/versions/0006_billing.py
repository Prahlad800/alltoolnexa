"""Paid storage entitlements and Razorpay orders."""
from alembic import op
import sqlalchemy as sa
revision = '0006_billing'
down_revision = '0005_user_storage'
branch_labels = depends_on = None
SCHEMA = 'alltoolnexa_private'

def upgrade():
    op.create_table('billing_orders',
        sa.Column('id',sa.String(80),primary_key=True),
        sa.Column('user_id',sa.Uuid(),sa.ForeignKey(SCHEMA+'.users.id'),nullable=False),
        sa.Column('plan_id',sa.String(30),nullable=False),
        sa.Column('amount',sa.Integer(),nullable=False),
        sa.Column('payment_id',sa.String(80),unique=True),
        sa.Column('paid_until',sa.DateTime(timezone=True)),
        sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),schema=SCHEMA)
    op.create_index('ix_billing_orders_user_id','billing_orders',['user_id'],schema=SCHEMA)
    op.drop_constraint('ck_file_size','user_files',schema=SCHEMA,type_='check')
    op.create_check_constraint('ck_file_size','user_files','size_bytes > 0 AND size_bytes <= 1000000000',schema=SCHEMA)
    op.execute(f'ALTER TABLE {SCHEMA}.billing_orders ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE {SCHEMA}.billing_orders FROM PUBLIC, anon, authenticated')

def downgrade():
    op.drop_constraint('ck_file_size','user_files',schema=SCHEMA,type_='check')
    op.create_check_constraint('ck_file_size','user_files','size_bytes > 0 AND size_bytes <= 2000000',schema=SCHEMA)
    op.drop_table('billing_orders',schema=SCHEMA)
