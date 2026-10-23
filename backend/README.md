# AllToolNexa backend

Flask application: app.py. Authentication: demo_auth.py. Database: database.py, models.py and migrations. API-owned catalog snapshots: data. Tests: tests. Three-service HTTP verification: scripts/verify-local.py.

From this directory:

```powershell
.venv/Scripts/python.exe -m flask --app app:create_app run --host 127.0.0.1 --port 5000
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Install requirements.txt into a Python virtual environment on a fresh checkout. Local settings and credentials remain in .env; no credentials are moved into frontend or admin. Demo sessions are in memory and reset when the backend restarts.

The API reads data/published-tools.json, data/inventory.json and data/implementation-status.json. Refresh these from the project root with npm --prefix frontend run inventory. The API never imports frontend source code.

With all services running, execute scripts/verify-local.py using this virtual environment.
