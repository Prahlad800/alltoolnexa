# PythonAnywhere backend deployment

Workflow: `.github/workflows/deploy-backend.yml`.

1. In the GitHub repository open **Settings > Secrets and variables > Actions > New repository secret**.
2. Add `PA_API_TOKEN` using the token from the PythonAnywhere account API Token tab. Do not put the token in source code.
3. Open **Actions > AllToolNexa Flask Auto Deploy > Run workflow** to deploy manually. Future pushes to `main` that change `backend/**` or the workflow deploy automatically.

The configured target is `https://prahlad800.pythonanywhere.com`, with source files under `/home/prahlad800/alltoolnexa/backend`. The existing PythonAnywhere web app/WSGI configuration must point to this backend and its virtualenv. The workflow uploads application files and reloads the existing app; it does not create the app or run commands in its virtualenv. Install runtime requirements and run `flask --app app:create_app db-upgrade` there when dependencies or migrations change. Keep its private `.env` on PythonAnywhere.

Local `.env*`, virtualenvs, caches, logs, database files, test files and helper scripts are excluded from uploads. Existing remote files are not deleted. Transient API failures/rate limits retry; upload requests are paced. After reload, application, database and public availability must all return successful JSON before the run passes. A missing `PA_API_TOKEN` produces an explicit failure. Check the Actions log for the actual deployment result.

Endpoints and authentication follow the [PythonAnywhere API documentation](https://help.pythonanywhere.com/pages/API/).
