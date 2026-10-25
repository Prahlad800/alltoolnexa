# AllToolNexa backend

Flask application: app.py. Authentication: jwt_auth.py. Database: database.py, models.py and migrations. API-owned catalog snapshots: data. Tests: tests. Three-service HTTP verification: scripts/verify-local.py.

From this directory:

```powershell
.venv/Scripts/python.exe -m flask --app app:create_app run --host 127.0.0.1 --port 5000
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Install requirements.txt into a Python virtual environment on a fresh checkout. Local settings and credentials remain in .env; no private credentials are moved into frontend or admin. Demo users and sessions are in memory and reset when the backend restarts.

## User and admin sign-in

Public users register at `/signup`, sign in at `/login`, and view `/account` on port 3000. Administrators sign in only through the separate admin application on port 3001. Public signup always creates role `user`; it cannot create an administrator.

The API uses signed HS256 JWTs in separate HttpOnly, SameSite=Lax cookies for users and administrators. Tokens require issuer, audience, subject, role, expiry, issued-at, not-before and session ID claims. An active server-side session is also required, so logout revokes the token. Tokens are never returned for storage in localStorage. Mutations validate an allowed Origin; authenticated mutations also require the session's CSRF token. Passwords are hashed with scrypt. Login and signup are rate limited.

User endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`. Admin endpoints: `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`. Protected `/api/admin/catalog` and `/api/admin/health` require an admin session. `GET /api/auth/config` describes local/demo storage to the interface.

`AUTH_MODE=demo` is restricted to loopback. It uses the configured demo administrator and temporary in-memory user accounts. Existing opaque demo cookies are superseded. Frontend and admin cookies can coexist in one browser; logging out of one does not log out the other.

For permanent accounts, supply the real private PostgreSQL session-pooler URI (all placeholders replaced), set `AUTH_MODE=database`, set a cryptographically random `JWT_SECRET_KEY` of at least 32 bytes, configure `AUTH_ALLOWED_ORIGINS` with the actual HTTPS applications and leave `AUTH_COOKIE_SECURE=true`. Apply `flask --app app:create_app db-upgrade` before using authentication. Users and revocable session hashes then use the existing private database tables. Supabase's public URL/publishable key alone does not provide a PostgreSQL password; this implementation uses the application's private PostgreSQL tables, not the Supabase Auth REST service.

Create the first database administrator from the trusted backend console using `flask --app app:create_app create-admin`. It prompts for email and a hidden password with confirmation; `--username` defaults to `admin`. User passwords require at least 8 characters and administrator passwords at least 8. It never changes an existing account. No public administrator-signup route exists. Do not use the local demo credentials as production credentials.

Email verification, password reset email and cloud document sync are not implemented. The interface does not promise those features.

The API reads data/published-tools.json, data/inventory.json and data/implementation-status.json. Refresh these from the project root with npm --prefix frontend run inventory. The API never imports frontend source code.

With all services running, execute scripts/verify-local.py using this virtual environment.


User cloud storage: Free accounts receive 50 MB total with 2 MB per file. Apply migration `0005_user_storage` before enabling the dashboard; see `../frontend/docs/USER-STORAGE.md` for API limits and rollout. Production secure cookies use SameSite=None to support a frontend on another site, with trusted Origin and CSRF checks on mutations.
