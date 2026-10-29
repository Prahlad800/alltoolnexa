# Website languages and automatic translation

The public Next.js website uses **i18next + react-i18next**. English and Hindi UI catalogs are bundled and work without the translation engine. The other 24 UI catalogs are served by Flask after checking the existing paid-plan entitlement. The admin app remains English. No React Native app is included.

`GET /api/me` returns the current user ID (or null for visitors), server-owned plan ID, `is_premium`, and `allowed_languages`. Premium and Premium Plus unlock the 26 UI languages while the subscription is active. Expired plans fall back to English/Hindi. Browser storage remembers only the selected language; it never grants a paid entitlement.

`POST /api/i18n/translate` accepts `{"text":"Hello world","source":"en","target":"hi"}`. The `/translate` website page calls this API explicitly; typing or opening the page does not submit text. Text/results are not stored. Both source and target are authorized, text is limited to 2,000 characters, trusted Origin is required, and signed-in requests require the existing user session's CSRF token. The per-process limit is 20 requests/minute/IP and one concurrent inference; configure a shared rate limit at the reverse proxy when scaling workers.

## Enable Argos on a suitable backend host

Argos Translate is free/open source, with self-hosted inference and no paid translation API key. It is **optional** because the current PythonAnywhere deployment uploads code but does not install dependencies. Core requirements, migrations, health checks and deployment workflow do not require Argos. With the engine disabled or a model absent, the translation API returns an explicit 503; existing authentication, billing, storage, admin and UI catalogs continue to work.

In a trusted backend console, using the web app's Python environment:

```sh
cd /path/to/alltoolnexa/backend
# Install CPU PyTorch first so the resolver does not pull CUDA packages.
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements-translation.txt
# Set writable persistent model/cache directories for this service account.
export XDG_DATA_HOME=/path/to/private-translation-data
export XDG_CACHE_HOME=/path/to/private-translation-cache
export XDG_CONFIG_HOME=/path/to/private-translation-config
export ARGOS_DEVICE_TYPE=cpu
export ARGOS_DEBUG=0
python scripts/install_translation_model.py --source en --target hi
python scripts/install_translation_model.py --source hi --target en
```

Provision the sentence/tokenizer resources used by each model in that console too; the install script runs inference to catch missing resources. The official model index is on `raw.githubusercontent.com`; current model archives are on `argos-net.com`. A trusted official local archive can instead be passed with `--file /path/to/model.argosmodel`. Do not expose the installer through HTTP. Not every pair has an official model; install both directions explicitly and verify each pair before offering automatic translation. Traditional Chinese UI remains supported, but automatic translation rejects `zh-TW` until a dedicated script-correct model is available.

After provisioning, set `ARGOS_TRANSLATE_ENABLED=true` and the same persistent directory settings in the backend server environment, then reload the web app. Keep `ARGOS_DEBUG=0` so upstream diagnostics do not include input text. Test `/api/i18n/translate` from an allowed website Origin. UI catalogs are independent of machine models and remain usable when inference is unavailable.

Do not add Argos to the normal auto-deployment requirements or enable it on a host without the installed models and sufficient CPU/memory. No database migration or payment pipeline change is needed. A future dedicated translation worker may be used if the current web host cannot run inference.

## Checks

From `backend`: `python -m unittest discover -s tests -v`. Translation tests cover server-owned entitlements, expiry, authorization of both languages, validation, CORS, CSRF, throttling and optional-library failure. From the repository root: `python -m unittest discover -s .github/scripts -p 'test_*.py' -v` verifies the existing deployment safeguards.
