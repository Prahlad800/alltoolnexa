# Build verification before deployment

User passwords accept 8–256 characters in the signup form, API and database model. Existing password hashes are unchanged.

Production builds require a public HTTPS `NEXT_PUBLIC_SITE_URL` for canonical URLs. Before a domain is assigned, use a temporary reserved example origin only for local build verification:

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://alltoolnexa.example'
npm --prefix frontend run build
npm --prefix admin run build
```

Before deploying, replace the example origin with the real website origin, configure the API and allowed origins, and rebuild both apps. Do not deploy the example-origin build. Keep database URLs, JWT secrets and passwords in private environment settings.

Checks: frontend `npm test` and `npm run lint`; admin `npm run lint`; backend `.venv/Scripts/python.exe -m unittest discover -s tests -v`, `python -m pip check` and `flask --app app:create_app db-check`.
