# AllToolNexa implementation decisions and release gaps

Date: 24 October 2026 (Asia/Calcutta). Read [REPORT.md](REPORT.md) and [status.json](status.json) for coverage and uncertainty. This proposal preserves Next.js/React/JavaScript, Flask, PostgreSQL and browser-local file processing.

## Verified local baseline

The regenerated inventory reports 505 canonical tools, 145 aliases, 1,286 ideas and 18 categories. It lists 706 planned ideas and 23 requiring services or verified data. Inventory inclusion is not end-to-end functionality certification. The existing tool coverage document contains older counts and remains historical evidence.

Source inspection confirms a public Next.js frontend, separate admin, Flask API, SQLAlchemy user/session models and Alembic migrations. `backend/demo_auth.py` exposes explicitly loopback-only demo authentication; its routes are unavailable when demo mode is disabled. Database tables alone do not provide production signup/login. The admin remains read-only. No production subscription integration or R2 job pipeline was implemented in this change.

## Comparison and priorities

| Area | Competitor evidence / pattern | Existing AllToolNexa | Gap and action |
|---|---|---|---|
| Tool functionality | iLovePDF/PDF24 publish organized PDF task directories | Existing PDF/image engines and canonical registry | Preserve working tools; certify real fixtures individually rather than equate catalog counts with quality |
| UI and discovery | India sites expose task and form-oriented entry points | Homepage search, categories, recent and popular tools | Added an original form-file section linking existing canonical tools |
| Preview | PDF/editor and image task interfaces are visible in captures; processing not certified | Local image, PDF and spreadsheet previews already exist | Keep previews and keyboard controls; extend accessible editor testing |
| Downloads | Competitor download behavior still pending runtime tests | Object URLs and explicit downloads | Preserve originals and old results on failure; tested compressor download |
| Compression | ImResizer/IndiaDigital/11zon advertise size-oriented workflows | Quality-based image encoding | Added byte-verified target-KB mode and exact byte reporting; dimensions preserved |
| Performance | Competitor load requests captured; comparable performance benchmarks unknown | Lazy-loaded editors and processing workers | Retain workers; benchmark representative low-memory devices before changing budgets |
| Mobile | Competitor responsive interaction not certified | Existing mobile navigation and category selector | New compressor checked at 375 px with no horizontal overflow |
| SEO | Tool-specific routes, navigation and metadata visible | Canonical tool routes, metadata, JSON-LD, sitemap and aliases | Preserve canonical registry; avoid empty programmatic pages and unverified exam-spec pages |
| Free/premium | Official pricing pages show several quota/subscription models | Core tools work locally without accounts | Keep free local tools; scope any future hosted metering separately |
| API/backend | Public API documentation can establish contracts, not private internals | Flask handles local API/admin foundation; file tools are local | Do not add uploads to reproduce competitors; hosted conversion is a separate, opt-in future capability |

## Implemented original change

`image-compressor` now accepts a maximum output size. Presets are 20, 50, 100 and 200 decimal KB (1 KB = 1,000 bytes); zero preserves quality-only operation. At the current image dimensions the encoder tries the selected maximum quality, then a minimum quality of 0.1 and up to eight measured intermediate candidates. It only returns a target-mode output whose actual bytes meet the cap. Browser encoders may not be monotonic, so this is a bounded search, not a guarantee of globally optimal quality or every mathematically achievable target. An unreachable target asks the user to resize or raise the cap. Dimensions never change implicitly.

JPEG uses the existing white background behavior. Re-encoding strips metadata and can reduce detail; originals remain untouched. The worker and main-thread paths share the same implementation. Large inputs retain existing memory/file limits and worker cancellation. No third-party compression API, credential or competitor algorithm was added.

The homepage now links compression, dimension setting and careful PDF compression as form-oriented tasks using existing routes/styles. It deliberately does not assert compliance with a particular exam: exact specifications must come from a dated official application notice.

## Proposed architecture: not implemented hosted services

The default processing path stays `tool registry → workbench → local worker/canvas/PDF engine → preview → local download`. No file-storage service is needed for this path. Saved preferences may be local; private input retention must remain an explicit product choice.

If unsupported conversions later need server execution, introduce a separate Flask job API with a versioned job schema, authenticated job ownership where appropriate, idempotency keys and per-operation quotas. A proposed lifecycle is `queued → running → succeeded/failed/cancelled/expired`; progress should reflect worker stages rather than invented percentages. PostgreSQL holds job metadata, not file bytes. A queue dispatches isolated converters with CPU/memory/time limits. R2 or equivalent private storage holds short-lived objects with signed downloads and enforced expiry. This is a proposal, not an inference about competitors and not an existing AllToolNexa feature.

Require explicit upload consent and tool-specific retention disclosure before such a flow. Validate extensions, MIME, file signatures and decoder limits; cap decompressed archives, PDF pages and pixels. Restrict converter egress. URL imports need SSRF protection including private/reserved IP checks after DNS resolution and every redirect. Validate ownership on every status/download/delete action. Give uploads separate quotas from the current small JSON request limit. Keep API keys and storage credentials server-side.

## Documented public API findings

These contracts were read from official documentation, not executed against a paid account, and do not prove a competitor web UI uses the same API.

* FreeConvert documents a `https://api.freeconvert.com/v1/` base with HTTPS Bearer-key authentication. A job definition can compose named import, conversion and export tasks with dependencies and options, submitted to `POST /process/jobs`. Sources: [overview](https://www.freeconvert.com/api/v1/), [authentication](https://www.freeconvert.com/api/v1/authentication/), [job submission](https://www.freeconvert.com/api/v1/getting-started/submitting-jobs/).
* Tinify documents HTTPS Basic authentication using an API key, binary or URL-source submission to `POST /shrink`, a creation response with a Location header, and retrieval from the output URL. Additional transform/resize requests can operate on that output. Source: [HTTP API](https://tinypng.com/developers/reference/http). No API request was sent.
* CloudConvert's selected API documentation URL returned an unsupported Markdown content type in the web reader. Its detailed job contract remains unverified in this audit; homepage/pricing observations do not substitute for it.

## Production release gates

1. Complete production authentication/session endpoints, email verification/reset, secure-cookie configuration and role enforcement; test against the migrated database. Never expose the demo mode as production authentication.
2. Certify each published browser/file tool using valid, invalid, encrypted, oversized and Unicode fixtures as applicable. Preserve exact conversion limitations, especially editable Office conversion, Indic PDF text and digital signatures.
3. Finish competitor workflow, mobile and API-contract investigation in the ledger. Raw homepage traffic cannot establish file deletion, queue topology, database choice or cloud-vendor claims.
4. Validate production origin/canonical URLs, sitemap, robots, structured data and error routing. Add original useful explanations, not copied competitor text or speculative search-ranking claims.
5. Exercise CSP and other response headers with existing local workers, downloads and previews before tightening policy. Audit dependencies/licenses and isolate any future hosted parsers.
6. Measure real devices, keyboard navigation, screen-reader announcements, cancellation and memory cleanup. The current desktop Edge/mobile-viewport check is not cross-browser accessibility certification.
7. Add billing only after defining hosted benefits and quotas; verify signed webhooks, idempotent entitlements and cancellation. No paid checkout, deployment or production configuration was changed here.

## Validation

The regression run after the compressor change: 516 tests, 511 passed, five skipped, zero failed. Four focused target-encoder tests cover quality-only compatibility, exact decimal byte caps, unreachable targets and unsupported/invalid encoders. Frontend lint: zero errors and four existing image-element warnings. A subsequent homepage-only edit does not change the engine; final lint/build results are recorded in VALIDATION.md.

Real browser evidence is in `frontend/runtime-results/target-image/`: deterministic synthetic 256×256 noise PNG → 19,600-byte JPEG under a 20,000-byte cap; dimensions preserved, download succeeded, no horizontal overflow at 375 px and no POST/PUT/PATCH requests observed during processing. An impossible target showed an error and retained the prior result. This tests one workflow and one browser, not all tools.
