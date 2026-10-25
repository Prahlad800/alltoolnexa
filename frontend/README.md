# AllToolNexa public frontend

All website UI lives in src. The browser-local tool engine and registry live in shared. Tests live in tests and shared/*.test.mjs. Vendor preparation, inventory and HTTP verification scripts live in scripts. Documentation, audit reports and screenshots live in docs; runtime artifacts and logs have their own folders here.

```powershell
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
npm test
npm run lint
npm run inventory
```

Production: set NEXT_PUBLIC_SITE_URL to the real public HTTPS origin, then run npm run build and npm start. Public tools do not require a running backend. Login requires the Flask service on port 5000 or NEXT_PUBLIC_API_URL.

The inventory source is shared/inventory.json. npm run inventory refreshes generated metadata here and backend/data snapshots when the sibling backend is present. Browser runtime imports stay inside this folder. The admin UI has its own client/config helpers.

See ../README.md for the three-service startup commands. Historical audit evidence is in docs; file paths inside old reports may describe the pre-restructure layout.


The default API is `https://prahlad800.pythonanywhere.com` for browser requests and server-rendered availability. Set `NEXT_PUBLIC_API_URL` to override it, then rebuild. For local backend development use `http://127.0.0.1:5000`. Backend deployment and configuration are managed separately.
