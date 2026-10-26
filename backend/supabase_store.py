"""Backend-only Supabase RPC transport for hosts without outbound PostgreSQL."""
import json
import base64
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from sqlalchemy.exc import IntegrityError, SQLAlchemyError


class SupabaseStore:
    def __init__(self, url, key):
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment or parsed.port not in (None,443):
            raise ValueError('SUPABASE_URL must be the HTTPS project origin.')
        if not key or not (key.startswith('sb_secret_') or key.startswith('eyJ')):
            raise ValueError('Set the backend Supabase secret API key.')
        if key.startswith('eyJ'):
            try:
                role=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))['role']
            except (ValueError,KeyError,IndexError,TypeError):
                raise ValueError('Set a valid Supabase backend secret key.') from None
            if role != 'service_role':
                raise ValueError('The publishable/anon key cannot be used for backend storage.')
        self.endpoint = url.rstrip('/') + '/rest/v1/rpc/alltoolnexa_backend'
        self.headers = {'apikey':key, 'Content-Type':'application/json', 'Accept':'application/json'}
        if key.startswith('eyJ'):
            self.headers['Authorization'] = 'Bearer ' + key

    def call(self, operation, **arguments):
        body = json.dumps({'operation':operation, 'arguments':arguments}, default=str).encode()
        req = Request(self.endpoint, data=body, headers=self.headers, method='POST')
        try:
            with urlopen(req, timeout=25) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                code = json.loads(error.read(65536)).get('code')
            except (ValueError, AttributeError):
                code = None
            finally:
                error.close()
            if code == '23505':
                raise IntegrityError(None, None, Exception('Record already exists.')) from None
            raise SQLAlchemyError('Supabase data service is unavailable.') from None
        except (URLError, TimeoutError, ValueError):
            raise SQLAlchemyError('Supabase data service is unavailable.') from None
