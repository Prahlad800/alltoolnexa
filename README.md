# AllToolNexa

The application has three main folders. Each service owns its code, configuration, dependencies and tests.

```text
alltoolnexa/
  frontend/    Public Next.js website, tool engine, UI, tests, scripts and docs
  backend/     Flask API, authentication, database migrations, data and tests
  admin/       Next.js admin UI and its API/config helpers
```

The root package.json contains convenience commands only; .git and .gitignore are repository metadata.

## Run locally

Use three terminals from the project root:

```powershell
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000
npm --prefix admin run dev -- --hostname 127.0.0.1 --port 3001
```

For the backend, change into its directory first so Flask finds the application:

```powershell
cd backend
.venv/Scripts/python.exe -m flask --app app:create_app run --host 127.0.0.1 --port 5000
```

Website: http://127.0.0.1:3000. Admin: http://127.0.0.1:3001. API: http://127.0.0.1:5000/api/health.

Document workspaces: `/tools/pdf-editor`, `/tools/spreadsheet-editor`, `/tools/invoice-generator` and `/tools/invoice-converter`. See [features, supported file formats and limits](frontend/docs/DOCUMENT-WORKSPACES.md). Existing invoices can be extracted/reviewed separately from creating a new structured invoice.

Install Node dependencies separately in frontend and admin with npm install. Backend Python dependencies are in backend/requirements.txt. Existing local environment files remain within their service folders.

## Checks and data

```powershell
npm test
npm run inventory
npm --prefix frontend run lint
npm --prefix admin run lint
backend/.venv/Scripts/python.exe backend/scripts/verify-local.py
```

Run Python unit tests from backend with `.venv/Scripts/python.exe -m unittest discover -s tests -v`.

Tool implementations and inventory source live in frontend/shared. The inventory command generates frontend metadata and copies the three API catalog snapshots into backend/data when that sibling service is present. The Flask API reads only its own data directory. Admin does not import source files from frontend.

Frontend build requires NEXT_PUBLIC_SITE_URL set to the real HTTPS origin. Configure public API/admin origins separately for each service when deploying. No database credentials belong in browser environment variables.

Audit reports and screenshots: frontend/docs. Runtime audit artifacts: frontend/runtime-results. Previous run logs: frontend/logs. Historical project notes: frontend/docs/PROJECT-NOTES.md.
