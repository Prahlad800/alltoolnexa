# Language selection and local i18n

The public website uses `i18next` / `react-i18next` with local message catalogs. There is no translation API, API key, paid translation call or uploaded-document translation in this feature.

- First visit opens an accessible native language dialog. English and Hindi are free, including anonymous sessions. Header globe button reopens the dialog.
- Only the chosen locale code is saved in localStorage (`alltoolnexa-language`). Page navigation and reload restore it. No documents or entered text are saved by this feature.
- 24 additional interface languages are offered to **active Premium and Premium Plus** subscribers. Basic and Pro do not grant these languages. Core tools remain free in English/Hindi.
- Premium access is verified by Flask against the existing server-owned billing entitlement. Passing a plan name in a URL or editing browser storage does not grant access. Expired sessions fall back to English.
- Arabic sets `dir=rtl`; Hindi sets the document language to `hi`. Catalog text is rendered as escaped React text, not injected HTML.

## Source and deployment

`shared/i18n.mjs` contains the free language configuration, Hindi common messages and authored catalog-label terminology. `shared/premium-locales.mjs` contains the authored local translations for 24 additional languages. Run `node scripts/prepare-locales.mjs` from frontend after editing these translations; it writes the committed backend `data/locales/*.json` files. The backend deploy must include these JSON files and `localization.py`.

`GET /api/i18n/messages/<locale>` returns the Premium message bundle only after authentication and entitlement verification. It is private/no-store. `I18N_CATALOG_DIR` optionally overrides the local catalog directory; leave unset for the bundled catalogs. English/Hindi switching runs without this endpoint. The Cloudflare API proxy forwards Accept-Language for localized access errors.

Supported Premium locale codes: es, fr, de, it, pt, ja, ru, ko, zh-CN, zh-TW, ar, bg, ca, nl, el, id, ms, pl, sv, th, tr, uk, vi, sw.

## Coverage and limitations

Translations currently cover shared navigation, categories, common processing controls, and principal PDF/image actions. Hindi also uses an authored terminology glossary for registered tool labels. Detailed help, some field-specific labels, editor ribbons, account screens, metadata and long descriptions still contain English fallback. This is **not a claim that every sentence of all 507 tools is fully localized**. Keep English explanations visible until their exact translated counterparts are added; do not shorten safety/fidelity limitations. Translating user documents is a separate feature.

The static-compatible provider initially renders English for consistent hydration, then restores the saved locale in the browser. Localized server-rendered SEO routes/metadata are not implemented by this increment. Cross-browser linguistic review of all catalogs and full Arabic layout QA remain necessary.

## Verification

- `node scripts/verify-languages.mjs`: first visit popup, free Hindi homepage/tool controls, persisted selection, denied Premium request retaining the current locale, French catalog loading, expired-session fallback, English switch, mobile overflow and browser errors. Premium access in this browser test is mocked; backend entitlement checks are tested separately.
- `npm.cmd test`: local catalogs match backend snapshots, all supported Premium languages have core messages, and existing tool regressions.
- Backend: `.venv/Scripts/python.exe -m unittest discover -s tests -p test_localization.py -v`. Tests cover anonymous free access, rejected unsupported locales, rejected spoofed plan, Premium entitlement, local catalog loading, invalid/missing catalogs, localized errors and CORS.
- `npm.cmd run lint` and production build with configured deployment origins.
