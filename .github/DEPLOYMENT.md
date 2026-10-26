# PythonAnywhere backend deployment

Pushes to `main` that change backend code, this workflow or deployment scripts run backend/deployment tests before uploading tracked backend files. PostgreSQL integration tests exercise the restricted RPC on an isolated CI database. The repository secret `PA_API_TOKEN` authenticates the PythonAnywhere API. Checkout `.env` files, virtualenvs, logs, temporary files and local databases are excluded. GitHub Actions reads the existing server `.env` into memory for preflight; credentials are never logged or saved to artifacts.

Deployment requires an existing configured PythonAnywhere web app and virtualenv with backend requirements installed. The API reloads that app after uploads. The workflow does not install packages in the remote virtualenv or automatically apply database migrations; handle requirement/schema changes before deploying application code that needs them.

Successful deployment requires all three endpoints to respond correctly: `/api/health` in database mode, `/api/health/database` with a connected database, and `/api/public/availability`. Generic HTML, demo mode and unhealthy storage cannot produce a green deployment.

## Supabase on a PythonAnywhere free account

Supabase PostgreSQL is an external TCP service. PythonAnywhere free accounts cannot connect to external PostgreSQL, including Supabase, even with correct credentials. This backend therefore supports an alternative **Supabase HTTPS RPC transport**, using the project's allowlisted HTTPS Data API. Database tables remain in the private schema. The RPC accepts only predefined operations, is executable by `service_role` only, and runs uploads, quota checks and payment activation in database transactions.

Apply database migration `0007_supabase_https` from a trusted machine with PostgreSQL connectivity using `flask --app app:create_app db-upgrade`. Add repository secrets `PA_SUPABASE_URL` (HTTPS project origin) and `PA_SUPABASE_SECRET_KEY` (backend secret key, or legacy `service_role` key). The next deployment checks the RPC, uploads code and updates only `DATABASE_TRANSPORT`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the existing server environment before reloading. Existing JWT, origin and other settings are preserved. Supabase publishable/anon keys cannot execute the backend RPC. Never put this secret in frontend/admin variables.

Once configured, `GET /api/health/database` reports `database=connected` and `transport=supabase-https`. No direct PostgreSQL connection is used by web requests in this mode. PostgreSQL remains the default for local use and trusted migration/admin commands. If neither HTTPS repository secret nor server HTTPS configuration is present, the deployment continues to check the existing PostgreSQL configuration and fails honestly if unreachable.

Use Supabase's IPv4 session pooler connection string on port 5432 with SSL; the application rejects transaction port 6543. Keep it in the server-side `.env`, never in browser variables or repository files.

The API and its security boundaries are shared across both transports: signed HttpOnly user/admin cookies, server-side revocation, role checks, Origin/CSRF checks, account file isolation, quota locks, verified captured-payment activation and idempotency. Existing large paid-plan file limits still require adequate host/API request and memory limits; the free PythonAnywhere instance cannot be assumed to support 1 GB requests.

References: [PythonAnywhere database support](https://help.pythonanywhere.com/pages/KindsOfDatabases/), [PythonAnywhere's Supabase/free-account explanation](https://www.pythonanywhere.com/forums/topic/33595/), [deployment API](https://help.pythonanywhere.com/pages/API/).
