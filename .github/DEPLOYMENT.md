# PythonAnywhere backend deployment

## Web app and admin configuration

The deployed API origin is `https://prahlad800.pythonanywhere.com`. In the PythonAnywhere WSGI configuration, add `/home/prahlad800/alltoolnexa/backend` to `sys.path`, then use `from wsgi import application`. Select the virtualenv containing `backend/requirements.txt` and reload the web app.

For the admin host, use `admin` as the project root, `npm ci` as the install command, `npm run build` to build, and `npm run start` for a Node server. Configure `NEXT_PUBLIC_API_URL=https://prahlad800.pythonanywhere.com` and `NEXT_PUBLIC_SITE_URL` as the actual public website HTTPS origin before building. Set `NEXT_PUBLIC_ADMIN_URL` to the deployed admin HTTPS origin if needed. Browser variables are embedded at build time: changing them requires rebuilding. Do not upload local `.env.local` files containing loopback URLs to production.

In the backend server `.env`, set `AUTH_ALLOWED_ORIGINS` to the exact public website and admin HTTPS origins, separated by a comma, and `AUTH_COOKIE_SECURE=true`. Keep `AUTH_MODE=database` and the existing private database/JWT settings. Reload the backend after changing its environment. A working database health endpoint alone does not verify admin login: test login from the deployed admin origin as well.

Pushes to `main` that change backend code, this workflow or deployment scripts run backend/deployment tests before uploading tracked backend files. PostgreSQL integration tests exercise the restricted RPC on an isolated CI database. The repository secret `PA_API_TOKEN` authenticates the PythonAnywhere API. Checkout `.env` files, virtualenvs, logs, temporary files and local databases are excluded. GitHub Actions reads the existing server `.env` into memory for preflight; credentials are never logged or saved to artifacts.

Deployment requires an existing configured PythonAnywhere web app and virtualenv with backend requirements installed. The API reloads that app after uploads. The workflow does not install packages in the remote virtualenv or automatically apply database migrations; handle requirement/schema changes before deploying application code that needs them.

Successful deployment requires all three endpoints to respond correctly: `/api/health` in database mode with `revision` matching the pushed Git commit, `/api/health/database` with a connected database and the configured transport, and `/api/public/availability`. The workflow records `GITHUB_SHA` as the server's `DEPLOYMENT_REVISION` before reload. Generic HTML, an older application revision, demo mode and unhealthy storage cannot produce a green deployment.

## Supabase on a PythonAnywhere free account

Supabase PostgreSQL is an external TCP service. PythonAnywhere free accounts cannot connect to external PostgreSQL, including Supabase, even with correct credentials. This backend therefore supports an alternative **Supabase HTTPS RPC transport**, using the project's allowlisted HTTPS Data API. Database tables remain in the private schema. The RPC accepts only predefined operations, is executable by `service_role` only, and runs uploads, quota checks and payment activation in database transactions.

Apply database migration `0007_supabase_https` from a trusted machine with PostgreSQL connectivity using `flask --app app:create_app db-upgrade`. Add repository secrets `PA_SUPABASE_URL` (HTTPS project origin) and `PA_SUPABASE_SECRET_KEY` (backend secret key, or legacy `service_role` key). The next deployment checks the RPC, uploads code and updates only `DATABASE_TRANSPORT`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the existing server environment before reloading. Existing JWT, origin and other settings are preserved. Supabase publishable/anon keys cannot execute the backend RPC. Never put this secret in frontend/admin variables.

Once configured, `GET /api/health/database` reports `database=connected` and `transport=supabase-https`. No direct PostgreSQL connection is used by web requests in this mode. PostgreSQL remains the default for local use and trusted migration/admin commands. If neither HTTPS repository secret nor server HTTPS configuration is present, the deployment continues to check the existing PostgreSQL configuration and fails honestly if unreachable.

Use Supabase's IPv4 session pooler connection string on port 5432 with SSL; the application rejects transaction port 6543. Keep it in the server-side `.env`, never in browser variables or repository files.

The API and its security boundaries are shared across both transports: signed HttpOnly user/admin cookies, server-side revocation, role checks, Origin/CSRF checks, account file isolation, quota locks, verified captured-payment activation and idempotency. Existing large paid-plan file limits still require adequate host/API request and memory limits; the free PythonAnywhere instance cannot be assumed to support 1 GB requests.

References: [PythonAnywhere database support](https://help.pythonanywhere.com/pages/KindsOfDatabases/), [PythonAnywhere's Supabase/free-account explanation](https://www.pythonanywhere.com/forums/topic/33595/), [deployment API](https://help.pythonanywhere.com/pages/API/).

## Annual billing RPC compatibility update

Annual prices are ₹349 / ₹949 / ₹1,599 / ₹2,000 for Basic / Pro / Premium / Premium Plus. General table/schema migrations still require the trusted migration workflow. For this backwards-compatible annual feature only, deployment may update `alltoolnexa_backend` transactionally using an existing server DATABASE_URL whose direct hostname or session-pooler username matches the configured Supabase project. It preserves SSL and never prints credentials. An already-updated RPC requires no database connection.

If that binding is absent, mismatched or inaccessible, deployment continues with monthly billing and the new backend refuses annual order creation before contacting Razorpay. Apply `backend/migrations/supabase_backend.sql` in the correct Supabase SQL Editor (or `flask --app app:create_app db-upgrade` using trusted PostgreSQL access), then check `/api/billing/plans` advertises `yearly`. The Actions summary records annual readiness separately. When enabled, post-deploy health verifies both annual capability and the exact public price catalog.
