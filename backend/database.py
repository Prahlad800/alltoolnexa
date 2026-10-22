from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.engine import make_url

db = SQLAlchemy()
SCHEMA = 'alltoolnexa_private'


def database_options(raw_url):
    if not raw_url.strip():
        return {}
    url = make_url(raw_url.strip())
    if url.drivername not in {'postgres', 'postgresql', 'postgresql+psycopg'}:
        raise ValueError('DATABASE_URL must be a PostgreSQL connection string.')
    url = url.set(drivername='postgresql+psycopg')
    if url.port == 6543:
        raise ValueError('Use Supabase session pooler port 5432 instead of transaction mode.')
    if url.query.get('sslmode') not in {None, 'require', 'verify-ca', 'verify-full'}:
        raise ValueError('DATABASE_URL must enable SSL.')
    if 'sslmode' not in url.query:
        url = url.update_query_dict({'sslmode': 'require'})
    return {
        'SQLALCHEMY_DATABASE_URI': url,
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_pre_ping': True, 'pool_size': 3, 'max_overflow': 2,
            'pool_timeout': 10, 'pool_recycle': 300, 'hide_parameters': True,
            'connect_args': {'connect_timeout': 10},
        },
    }
