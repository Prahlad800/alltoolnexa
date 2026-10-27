# Cloudflare Pages

Use the GitHub repository `Prahlad800/alltoolnexa`, production branch `main`, root directory `frontend`, build command `npm run build:pages`, and output directory `out`.

Set production build variables:

```dotenv
NEXT_PUBLIC_SITE_URL=https://alltoolnexa.pages.dev
NEXT_PUBLIC_API_URL=https://prahlad800.pythonanywhere.com
```

Leave `NEXT_PUBLIC_ADMIN_URL` unset until the separate admin application is deployed. Never upload local `.env.local` files or backend secrets. Configure preview builds separately if they should use a different canonical origin.

`build:pages` enables Next.js static export and runs the normal prebuild steps, including vendor worker preparation. Public tools, search, contact query parameters, login and account API requests run in the browser. Availability is refreshed from the Flask API in the browser; it is not frozen at build time. Pages applies security headers and legacy redirects from `public/_headers` and `public/_redirects`.

The backend must allow `https://alltoolnexa.pages.dev` in `AUTH_ALLOWED_ORIGINS` and use `AUTH_COOKIE_SECURE=true`. Redeploying the static frontend does not update the backend environment. Confirm login from the deployed frontend after reloading the backend; cross-site cookies may be restricted by the browser.

The ordinary `npm run build` retains the Next.js server deployment mode.
