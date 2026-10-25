# User dashboard and Free cloud storage

After user login/signup the frontend opens `/dashboard`; `/account` redirects there. The signed-in header links to Dashboard. It shows the account email, Free plan, measured used/remaining bytes and files, with upload/download/delete and pagination. Limits use decimal MB: 50,000,000 bytes total, 2,000,000 bytes per file. Cloud uploads are explicit; document editors continue saving local drafts.

Backend migration `0005_user_storage` creates the private RLS-protected `user_files` table. File bytes are stored in PostgreSQL alongside owner metadata. Browser Supabase roles cannot access this table. The user JWT and CSRF protect mutations; a row lock on the owner serializes quota checks and inserts/deletes. A file's UUID never grants access to another account. Downloads use attachment/octet-stream, no-store and nosniff. Metadata listing defers binary content. Cloud deletion is permanent; it is separate from visitor analytics Trash.

API: GET `/api/user/storage?page=1`; POST multipart `/api/user/storage/upload` with a single `file`; GET `/api/user/storage/files/<id>`; POST `/api/user/storage/files/<id>/delete`. Upload accepts at most 2 MB plus limited multipart overhead, while other auth requests keep their existing smaller limit.

## PythonAnywhere rollout

Upload/pull the updated backend code, run `.venv/bin/python -m flask --app app:create_app db-upgrade` using the configured virtualenv/database, then reload the PythonAnywhere web app. This source change does not itself reload that remote app. The local migration uses the configured database. Configure `AUTH_ALLOWED_ORIGINS` for the actual frontend origin. With `AUTH_COOKIE_SECURE=true`, auth and visitor cookies use `SameSite=None` for frontend/backend on separate HTTPS sites. Local insecure cookies keep `SameSite=Lax`. Some browsers still block third-party cookies; use a shared site/reverse proxy for reliable sessions. Do not enable insecure cookies for production.

The frontend retains the PythonAnywhere API default. Local verification can set `NEXT_PUBLIC_API_URL=http://127.0.0.1:5000` and `BACKEND_INTERNAL_URL=http://127.0.0.1:5000`, then restart Next dev. A server without the new endpoint displays a storage setup error instead of claiming files were saved.
