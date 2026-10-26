# PythonAnywhere backend deployment

Pushes to `main` that change backend code, this workflow or deployment scripts run backend/deployment tests before uploading tracked backend files. The repository secret `PA_API_TOKEN` authenticates the PythonAnywhere API. The server's `.env`, virtualenv, logs, temporary files and local databases are never uploaded. GitHub Actions reads the existing server `.env` into memory only to validate its PostgreSQL connection; credentials are never logged or saved to artifacts.

Deployment requires an existing configured PythonAnywhere web app and virtualenv with backend requirements installed. The API reloads that app after uploads. The workflow does not install packages in the remote virtualenv or automatically apply database migrations; handle requirement/schema changes before deploying application code that needs them.

Successful deployment requires all three endpoints to respond correctly: `/api/health` in database mode, `/api/health/database` with a connected database, and `/api/public/availability`. Generic HTML, demo mode and unhealthy storage cannot produce a green deployment.

## Supabase on a PythonAnywhere free account

Supabase PostgreSQL is an external TCP service. PythonAnywhere free accounts cannot connect to external PostgreSQL, including Supabase, even with correct credentials. Changing GitHub Actions retries, the API token or the Supabase allowlist does not remove this hosting restriction. Keep the database checks enabled.

If the workflow's database preflight succeeds from GitHub Actions but PythonAnywhere reports database HTTP 503, check the PythonAnywhere account's outbound-network support. A paid PythonAnywhere plan with external connections, or a backend host that supports external PostgreSQL, is required for this application's current database driver. Supabase's HTTPS API is a separate integration and is not a drop-in replacement for the PostgreSQL URI.

Use Supabase's IPv4 session pooler connection string on port 5432 with SSL; the application rejects transaction port 6543. Keep it in the server-side `.env`, never in browser variables or repository files.

References: [PythonAnywhere database support](https://help.pythonanywhere.com/pages/KindsOfDatabases/), [PythonAnywhere's Supabase/free-account explanation](https://www.pythonanywhere.com/forums/topic/33595/), [deployment API](https://help.pythonanywhere.com/pages/API/).
