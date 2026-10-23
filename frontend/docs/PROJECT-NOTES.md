# Local three-service demo

The local preview is configured with `AUTH_MODE=demo` in `backend/.env`.
No Supabase, PostgreSQL or SQLite connection is used for demo login.
The username and password are set in that ignored local environment file.

Run each service from a separate terminal:

```powershell
# Terminal 1, project root
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000

# Terminal 2, project root
npm --prefix admin install
npm --prefix admin run dev -- --hostname 127.0.0.1 --port 3001

# Terminal 3, backend/
.venv/Scripts/python.exe -m flask --app app:create_app run --host 127.0.0.1 --port 5000
```

- Public website: http://localhost:3000
- Optional public sign-in: http://localhost:3000/login
- Admin workspace: http://localhost:3001
- Backend health: http://localhost:5000/api/health

On this machine, an ignored root `node_modules` junction lets the admin reuse
the frontend?s installed dependencies. Its interrupted duplicate installation
is preserved in `admin/.install-backup/`. A fresh checkout can install admin
dependencies separately using the command above.

The same demo ID/password works in the public sign-in and admin. Sessions use
HttpOnly cookies, expire after eight hours and reset when the backend restarts.
The backend accepts only loopback requests and the configured local UI origins
for this mode. Passwords and authentication tokens are not saved in localStorage.
The admin catalog is read-only; it does not pretend to save edits.

Verify the running services with:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/verify-local.py
```

---

# AllToolNexa

A local Next.js tools platform with **502 working tool implementations across
18 categories**, a normalized master inventory, and a Flask/Supabase database
foundation. Tool processing runs in the browser without an account.

## Run the website

From this folder (`alltoolnexa`):

```powershell
npm --prefix frontend install
npm run dev
```

Open **http://localhost:3000**. The public tools do not need Flask, Supabase or
API keys to work. For a production build:

```powershell
npm run build
npm start
```

Copy `frontend/.env.example` to `frontend/.env.local` and set
`NEXT_PUBLIC_SITE_URL` to the real HTTPS origin **before the production build**.
Set `NEXT_PUBLIC_CONTACT_EMAIL` when a real support address is available.
No database credentials belong in public Next.js environment variables.

## What is implemented

- Searchable tool directory, category filters and category landing pages.
- Individual server-rendered pages with inputs, explanations, worked examples,
  FAQs, related tools, canonical URLs and structured data.
- Math, student, salary, finance, marketing, SaaS, date/time, unit conversion,
  text, developer, design, India utility and everyday calculators.
- Browser-local image resizing, cropping, rotation, flipping, conversion,
  compression, metadata inspection, pixel color selection and watermarking.
- Local PDF merge, extraction, reorder, rotation, page numbering, watermarking,
  metadata inspection/cleanup, images-to-PDF and text-to-PDF.
- QR codes, barcode downloads, cryptographic random utilities and hashes.
- YAML/JSON, Markdown and source-code formatting; an isolated regex tester.
- Pomodoro/countdown timers and editable document/prompt templates.
- Relevant copy/download, reset and clear controls; light/dark preferences.
- Sitemap, robots.txt, About, Contact, Privacy, Terms and Disclaimer pages.

Document/prompt generators are explicitly **rule-based templates**. They do not
call an AI service or invent facts. Format checkers do not claim identity,
registration, ownership or deliverability verification. Rates, prices and
financial assumptions are provided by the user.

## Inventory and remaining scope

`frontend/shared/inventory.json` records **1,286 normalized ideas** from 1,341 entries in
the supplied tool list. Repeated entries retain their original categories.

The current registry has **502 canonical implementations** and **141 alias
names**. This covers **557 ideas in the source inventory**. The remaining
**729 ideas are unfinished** (706 planned and 23 initially classified as needing
services or verified data). Those are not published as working tools.

Aliases redirect to a canonical interface rather than creating duplicate thin
pages. Inventory matches and canonical counts differ because aliases may cover
multiple ideas and some registry names are normalized differently.

This is a substantial working release, **not completion of the entire pasted
brief**. The admin app now has local demo sign-in, a protected read-only catalog, master
inventory and health/account views. Frontend sign-in uses the same local demo
account. Production database-backed authentication, registration and admin CRUD
are not implemented. Supabase live connection and migrations require your real
credentials. Production hosting and
support contact details are not configured.

To refresh the generated inventory status and publishable metadata snapshot:

```powershell
npm run inventory
```

The generated status is `frontend/shared/implementation-status.json`; machine-readable
published tool definitions are in `frontend/shared/published-tools.json`.

## Source layout

```text
frontend/                     Public Next.js application
  src/app/                    Home, tool, category, legal and SEO routes
  src/components/             Directory, workbench, timers and shared UI
  src/lib/                    Browser file processors, PDF/QR helpers, metadata
  tests/                      Real PDF/parser/artifact tests
admin/                        Local demo sign-in and read-only admin dashboard
backend/                      Flask and optional Supabase PostgreSQL foundation
  app.py                      App factory, health endpoints and migration CLI
  demo_auth.py                Loopback-only in-memory account/session API
  database.py                 SQLAlchemy engine and SSL/pool settings
  models.py                   Minimal user and session models
  migrations/                 Versioned private-schema migration
  tests/                      Configuration, schema and password tests
shared/
  catalog.mjs                 Core calculators and registration API
  core.mjs                    Validation, dates, CSV and number helpers
  extended.mjs                Randomness and browser tool definitions
  templates.mjs               Draft templates and developer snippets
  batch-two.mjs               Additional calculators and browser helpers
  inventory.json              Full normalized source list and statuses
scripts/                      Import, inventory and HTTP verification scripts
```

## Privacy and file limits

Inputs and results are not written to the database. Images, PDFs and text stay
in the browser; the public processors do not upload them. Local storage is used
only for theme and up to twelve recent tool identifiers. No input, binary file
or authentication token is put in local storage.

File tools allow at most 100 selected files, 50 MB per file and 100 MB total.
Image output is limited to 16,000 px per dimension and 40 million pixels.
Canvas re-encoding discards original metadata. Output can be larger than input.
Encrypted PDFs are unsupported; re-saving does not preserve digital signatures.
PDF metadata cleanup removes original document-level metadata, not embedded
content or confidential information visible on the page. Text-to-PDF currently
uses standard Latin fonts. The original file is never overwritten.

Markdown previews are sanitized, sandboxed and blocked from loading external
resources. Regex execution runs in a worker with a one-second timeout. Random
secrets use Web Crypto. JWT decoding never claims to verify a signature.

## Tests

```powershell
npm test
cd backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

JavaScript tests combine catalog example checks with independent reference
results and edge cases. File tests generate actual PDFs and re-open the outputs
to verify page counts/order, rotation, metadata, pagination and image embedding.
Additional tests cover YAML/JSON, Markdown, code formatting and QR payloads.

To verify a running production server (defaults to `127.0.0.1:3100`):

```powershell
npm run test:http
```

Set `TEST_ORIGIN` to check a different address. This verifies every tool/category
page, canonical metadata, structured data, sitemap, 404s and alias redirects.
HTTP checks do not verify browser hydration, mobile layout, canvas output,
clipboard behavior, timer interactions or actual QR/barcode scanning. The
browser automation service was unavailable in this session, so those checks
remain manual QA tasks.

## Supabase PostgreSQL setup

This uses Supabase as PostgreSQL with SQLAlchemy, not Supabase Auth. The database
contains only `alltoolnexa_private.users` and `auth_sessions` for future optional
authentication. Tool content remains in source/JSON, not database tables.

1. In your Supabase project open **Connect → Session pooler** and copy the URI
   using port **5432**. Use the exact host and username from your project.
2. Create the backend environment and install dependencies:

   ```powershell
   py -m venv backend/.venv
   backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
   ```

3. Copy `backend/.env.example` to `backend/.env` only if `.env` does not already
   exist. Replace its placeholder `DATABASE_URL` with the real URI. Percent-encode
   special characters in the password. Retain `sslmode=require`, or configure
   `verify-full` with the Supabase CA certificate.
4. Apply the versioned migration and check connectivity:

   ```powershell
   cd backend
   .venv/Scripts/python.exe -m flask --app app:create_app db-upgrade
   .venv/Scripts/python.exe -m flask --app app:create_app db-check
   .venv/Scripts/python.exe -m flask --app app:create_app run --port 5000
   ```

The migration enables RLS and revokes access from `PUBLIC`, `anon` and
`authenticated`. Do not expose `alltoolnexa_private` through the Data API. The
trusted backend/database owner accesses these tables; future account/admin
endpoints must enforce server-side authorization. Migrations are explicit, not
run automatically at startup. Database errors exposed over HTTP are generic.

Backend liveness is `/api/health`. Database readiness is
`/api/health/database`, which returns 503 when unconfigured or unreachable.
`db-check` also verifies that the authentication tables exist.

See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)
and [Data API security](https://supabase.com/docs/guides/api/securing-your-api).

## VPS deployment outline

Use Node 20.9+ (Node 22/24 recommended) for Next.js. Set the real site origin,
run `npm --prefix frontend ci` and `npm run build`, then supervise `npm start`
with your process manager. Bind the application to loopback and reverse proxy
from Nginx with an HTTPS certificate. Nginx should forward the host and protocol
headers. Keep secrets outside the repository. Deploy the optional Flask backend
separately with a production WSGI server; do not expose its development server.
The in-memory demo authentication is restricted to loopback and must not be
used as production authentication.

See `docs/nginx.example.conf` for the public frontend proxy. Rebuild after
changing tool definitions or SEO content so generated static pages and sitemap
stay consistent. Run the test suite and HTTP checks before switching traffic.
