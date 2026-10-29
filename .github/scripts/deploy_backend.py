"""Deploy tracked backend code without copying secrets or masking unhealthy storage."""
import io
import os
import re
import sys
import subprocess
import time
from pathlib import Path
from urllib.parse import quote, urlsplit

import requests
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

EXCLUDED_DIRS = {'.git', '.venv', 'venv', '__pycache__', '.pytest_cache', 'tests', 'scripts'}
EXCLUDED_SUFFIXES = {'.pyc', '.pyo', '.db', '.sqlite', '.sqlite3', '.log', '.bak', '.tmp'}
HEALTH_PATHS = ('/api/health', '/api/health/database', '/api/public/availability')


def production_origin_settings(settings, raw_origins):
    """Add explicitly configured application origins without discarding existing ones."""
    additions = [value.strip().rstrip('/') for value in raw_origins.split(',') if value.strip()]
    if not additions:
        return {}
    for origin in additions:
        url = urlsplit(origin)
        if (url.scheme != 'https' or not url.hostname or url.username or url.password
                or url.path or url.query or url.fragment
                or url.hostname in {'localhost', '0.0.0.0', '::1'}
                or url.hostname.startswith('127.')):
            raise RuntimeError('PA_ALLOWED_ORIGINS must contain public HTTPS origins only.')
    existing = [value.strip().rstrip('/') for value in settings.get('AUTH_ALLOWED_ORIGINS', '').split(',') if value.strip()]
    return {'AUTH_ALLOWED_ORIGINS': ','.join(dict.fromkeys(existing + additions)), 'AUTH_COOKIE_SECURE': 'true'}


def update_environment(content, values):
    for key, value in values.items():
        if '\n' in value or '\r' in value:
            raise RuntimeError('Environment settings must be single-line values.')
        replacement = key + "='" + value.replace('\\','\\\\').replace("'","\\'") + "'"
        pattern = r'(?m)^(?:export\s+)?'+re.escape(key)+r'\s*=.*$'
        if re.search(pattern,content):
            content = re.sub(pattern,lambda match:replacement,content)
        else:
            content = content.rstrip()+'\n'+replacement+'\n'
    return content


def deployable(path):
    return (path.parts[0] == 'backend' and len(path.parts) > 1
            and not any(part in EXCLUDED_DIRS for part in path.parts)
            and not path.name.startswith('.env')
            and path.suffix.lower() not in EXCLUDED_SUFFIXES)


def classify_database_error(error):
    """Never include exception text: it may contain credentials or host details."""
    message = str(error).lower()
    if 'password authentication failed' in message:
        return 'database credentials were rejected'
    if 'tenant or user not found' in message:
        return 'Supabase pooler username/project is invalid'
    if 'could not translate host' in message or 'name or service not known' in message:
        return 'database DNS resolution failed'
    if 'network is unreachable' in message:
        return 'database route is unavailable (check IPv4 session pooler)'
    if 'connection refused' in message or 'timeout' in message or 'timed out' in message:
        return 'database connection was refused or timed out'
    return 'database connection failed; verify connection settings and SSL'


def check_database_from_runner(raw_url):
    if not raw_url:
        return False, 'DATABASE_URL is missing from the server environment file'
    engine = None
    try:
        url = make_url(raw_url)
        if url.drivername not in {'postgres', 'postgresql', 'postgresql+psycopg'}:
            return False, 'DATABASE_URL must use PostgreSQL'
        if url.port == 6543:
            return False, 'Use Supabase session pooler port 5432, not transaction port 6543'
        url = url.set(drivername='postgresql+psycopg')
        if url.query.get('sslmode') not in {None, 'require', 'verify-ca', 'verify-full'}:
            return False, 'DATABASE_URL must require SSL'
        if not url.query.get('sslmode'):
            url = url.update_query_dict({'sslmode': 'require'})
        engine = create_engine(url, connect_args={'connect_timeout': 10}, hide_parameters=True)
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
        return True, 'The configured PostgreSQL database is reachable from GitHub Actions'
    except Exception as error:
        return False, classify_database_error(error)
    finally:
        if engine is not None:
            engine.dispose()


def enable_annual_rpc(client, project_url, raw_url):
    """Use only an existing, identity-matched Supabase DB binding; never log it."""
    try:
        import json
        expected = {plan['id']:plan['annualPrice'] for plan in json.loads(Path('backend/data/plans.json').read_text()) if plan['price']}
        def compatible(capability):
            return 'yearly' in capability.get('billingCycles', []) and capability.get('annualPrices') == expected
        if compatible(client.call('ping')):
            return True
        if not raw_url:
            return False
        project = urlsplit(project_url).hostname.split('.')[0]
        url = make_url(raw_url)
        matched = (url.host == 'db.' + project + '.supabase.co' or
                   (url.host and url.host.endswith('.pooler.supabase.com') and url.username == 'postgres.' + project))
        if not matched or url.drivername not in {'postgres', 'postgresql', 'postgresql+psycopg'} or url.port == 6543:
            return False
        if url.query.get('sslmode') not in {None, 'require', 'verify-ca', 'verify-full'}:
            return False
        url = url.set(drivername='postgresql+psycopg')
        if not url.query.get('sslmode'):
            url = url.update_query_dict({'sslmode':'require'})
        engine = None
        try:
            engine = create_engine(url, connect_args={'connect_timeout':10}, hide_parameters=True)
            with engine.begin() as connection:
                connection.execute(text(Path('backend/migrations/supabase_backend.sql').read_text(encoding='utf-8')))
        finally:
            if engine is not None:
                engine.dispose()
        return compatible(client.call('ping'))
    except Exception:
        # Keep monthly deployment operational; annual orders are capability-gated.
        # Provider exception messages can contain credentials and must not be printed.
        return False


class Deployment:
    def __init__(self):
        self.username = os.getenv('PA_USERNAME', 'prahlad800')
        self.domain = os.getenv('PA_DOMAIN', 'prahlad800.pythonanywhere.com')
        self.api_base = f'https://www.pythonanywhere.com/api/v0/user/{self.username}'
        self.remote = f'/home/{self.username}/alltoolnexa/backend'
        self.revision = os.getenv('GITHUB_SHA', '')
        if self.revision and not re.fullmatch('[0-9a-f]{40}', self.revision):
            raise RuntimeError('GITHUB_SHA must be a complete Git commit hash.')
        token = os.getenv('PA_API_TOKEN', '').strip()
        if not token:
            raise RuntimeError('Set the PA_API_TOKEN GitHub Actions repository secret.')
        self.session = requests.Session()
        self.session.headers['Authorization'] = f'Token {token}'

    def api(self, method, path, **kwargs):
        for attempt in range(5):
            for handle in kwargs.get('files', {}).values():
                handle.seek(0)
            try:
                response = self.session.request(method, self.api_base + path, timeout=60, **kwargs)
            except requests.RequestException:
                if attempt == 4:
                    raise RuntimeError('PythonAnywhere API request failed after retries.') from None
                time.sleep(5 * (attempt + 1))
                continue
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < 4:
                    try:
                        delay = float(response.headers.get('Retry-After', 5 * (attempt + 1)))
                    except ValueError:
                        delay = 5 * (attempt + 1)
                    time.sleep(min(60, max(1, delay)))
                    continue
            if not response.ok:
                raise RuntimeError(f'PythonAnywhere API returned HTTP {response.status_code}. Check the API token and web app configuration.')
            return response

    def server_configuration(self):
        config = self.api('GET', f'/webapps/{self.domain}/').json()
        print(f"PythonAnywhere Python version: {config.get('python_version', 'unknown')}", flush=True)
        print(f"Virtualenv configured: {bool(config.get('virtualenv_path'))}", flush=True)
        response = self.api('GET', '/files/path' + quote(self.remote + '/.env', safe='/'))
        # Parse only in memory. Never print or store the environment file in artifacts.
        settings = dotenv_values(stream=io.StringIO(response.text), interpolate=False)
        if settings.get('AUTH_MODE', 'database') != 'database':
            raise RuntimeError('Production must use AUTH_MODE=database; demo accounts are loopback-only.')
        origin_values = production_origin_settings(settings, os.getenv('PA_ALLOWED_ORIGINS', ''))
        key = os.getenv('PA_SUPABASE_SECRET_KEY') or settings.get('SUPABASE_SECRET_KEY')
        if os.getenv('PA_SUPABASE_SECRET_KEY') or settings.get('DATABASE_TRANSPORT') == 'supabase':
            url = os.getenv('PA_SUPABASE_URL') or settings.get('SUPABASE_URL') or settings.get('NEXT_PUBLIC_SUPABASE_URL','')
            sys.path.insert(0,str(Path('backend').resolve()))
            from supabase_store import SupabaseStore
            try:
                client = SupabaseStore(url,key)
                good = client.call('ping').get('connected') is True
            except Exception:
                raise RuntimeError('Supabase HTTPS preflight failed. Check the backend secret key, project URL and applied RPC migration.') from None
            if not good:
                raise RuntimeError('Supabase HTTPS database readiness failed.')
            annual_ready = enable_annual_rpc(client,url,settings.get('DATABASE_URL',''))
            self.expected_annual = annual_ready
            summary('Annual billing: '+('RPC ready for monthly/yearly payments.' if annual_ready else 'Database update pending; annual checkout is disabled, monthly checkout is preserved.'))
            self.expected_transport = 'supabase-https'
            values = {**origin_values, 'DATABASE_TRANSPORT':'supabase','SUPABASE_URL':url,'SUPABASE_SECRET_KEY':key}
            if self.revision:
                values['DEPLOYMENT_REVISION'] = self.revision
            self.pending_environment = update_environment(response.text,values).encode()
            print('Database preflight: Supabase HTTPS RPC connected.',flush=True)
            return True,'Supabase HTTPS connected'
        good, detail = check_database_from_runner(settings.get('DATABASE_URL', ''))
        if good:
            values = dict(origin_values)
            if self.revision:
                values['DEPLOYMENT_REVISION'] = self.revision
            if values:
                self.pending_environment = update_environment(response.text,values).encode()
        print('Database preflight: ' + detail, flush=True)
        return good, detail

    def upload(self):
        tracked = subprocess.check_output(['git', 'ls-files', '-z', '--', 'backend']).decode().split('\0')
        files = [Path(name) for name in tracked if name and deployable(Path(name))]
        if not files:
            raise RuntimeError('No tracked backend files found.')
        for path in files:
            if path.is_symlink() or not path.is_file():
                raise RuntimeError('A tracked deployment file is missing or is a symlink.')
            relative = path.relative_to('backend')
            with path.open('rb') as handle:
                self.api('POST', '/files/path' + quote(f'{self.remote}/{relative.as_posix()}', safe='/'), files={'content': handle})
            print(f'Uploaded: {relative.as_posix()}', flush=True)
            time.sleep(1.6)
        print(f'Uploaded {len(files)} tracked backend files; server .env preserved.', flush=True)

    def health(self):
        failures = []
        for path in HEALTH_PATHS:
            try:
                response = requests.get(f'https://{self.domain}{path}', headers={'Cache-Control': 'no-cache'}, timeout=15)
                payload = response.json()
                good = response.status_code == 200 and payload.get('success') is True
                if path == '/api/health':
                    good = good and payload.get('authMode') == 'database'
                    if getattr(self,'revision',''):
                        good = good and payload.get('revision') == self.revision
                if path == '/api/health/database':
                    good = good and payload.get('database') == 'connected'
                    if getattr(self,'expected_transport',None):
                        good = good and payload.get('transport') == self.expected_transport
                if not good:
                    failures.append(f'{path}: HTTP {response.status_code}; readiness, revision or transport did not match')
            except (requests.RequestException, ValueError, AttributeError):
                failures.append(f'{path}: unavailable or invalid JSON')
        if getattr(self,'expected_annual',False):
            try:
                response = requests.get(f'https://{self.domain}/api/billing/plans',headers={'Cache-Control':'no-cache'},timeout=15)
                payload = response.json()
                prices = {plan['id']:plan.get('annualPrice') for plan in payload.get('plans',[])}
                if response.status_code != 200 or 'yearly' not in payload.get('billingCycles',[]) or any(prices.get(key)!=value for key,value in {'basic':349,'pro':949,'premium':1599,'premium-plus':2000}.items()):
                    failures.append('/api/billing/plans: annual readiness or prices did not match')
            except (requests.RequestException,ValueError,AttributeError,KeyError,TypeError):
                failures.append('/api/billing/plans: unavailable or invalid JSON')
        return failures

    def run(self):
        database_ok, database_detail = self.server_configuration()
        if not database_ok:
            raise RuntimeError('Production database preflight failed: ' + database_detail + '. No files were deployed.')
        self.upload()
        if getattr(self,'pending_environment',None):
            self.api('POST','/files/path'+quote(self.remote+'/.env',safe='/'),files={'content':io.BytesIO(self.pending_environment)})
            print('Backend HTTPS transport configured; existing environment settings preserved.',flush=True)
        self.api('POST', f'/webapps/{self.domain}/reload/')
        print('Reload requested successfully.', flush=True)
        for attempt in range(6):
            failures = self.health()
            if not failures:
                summary('Backend deployed. Application revision, database and availability checks passed.')
                return
            print(f'Health check {attempt + 1}/6: ' + '; '.join(failures), flush=True)
            if attempt < 5:
                time.sleep(10)
        if getattr(self,'expected_transport',None) == 'supabase-https':
            raise RuntimeError('Files uploaded and reload succeeded, but production health failed. '
                               'Supabase HTTPS preflight passed. Check the PythonAnywhere WSGI source, '
                               'runtime requirements, environment and error log. ' + '; '.join(failures))
        raise RuntimeError('Files uploaded and reload succeeded, but production health failed. '
                           'The same PostgreSQL configuration works from GitHub Actions. '
                           'PythonAnywhere FREE accounts cannot connect to external PostgreSQL/Supabase over TCP. '
                           'Use a PythonAnywhere plan with external network access or a host supporting external PostgreSQL. '
                           'Do not disable database checks or switch production to demo mode. '
                           'If this account already has external access, inspect the web app environment and runtime error log. '
                           + '; '.join(failures))


def summary(message):
    print(message, flush=True)
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as output:
            output.write('## Backend deployment\n\n' + message + '\n')


if __name__ == '__main__':
    try:
        Deployment().run()
    except RuntimeError as error:
        summary(str(error))
        raise SystemExit(1)
