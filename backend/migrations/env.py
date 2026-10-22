from alembic import context
from database import db
import models

connection = context.config.attributes.get('connection')
if connection is None:
    raise RuntimeError('Run migrations with: py -m flask --app app:create_app db-upgrade')
context.configure(connection=connection, target_metadata=db.metadata, include_schemas=True)
with context.begin_transaction():
    context.run_migrations()
