# AllToolNexa admin

Admin pages/components live in src/app and src/components. API client and public-origin configuration live in src/lib. Dependencies are installed in this directory; no root node_modules junction or frontend source imports are needed.

```powershell
npm install
npm run dev -- --hostname 127.0.0.1 --port 3001
npm run lint
```

The backend must run on port 5000 for demo login and catalog views. Set NEXT_PUBLIC_API_URL for a different API origin. Set NEXT_PUBLIC_SITE_URL to the public HTTPS website origin for production builds. Local demo credentials are configured in backend/.env, not in admin source code. The catalog remains read-only.
