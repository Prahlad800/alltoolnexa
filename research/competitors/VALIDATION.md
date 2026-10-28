# Validation — 24 October 2026

## Application checks

| Check | Result | Scope |
|---|---|---|
| `npm test` from repository root | 516 tests: 511 passed, 5 skipped, 0 failed | Existing engine/regression suite plus four new target-encoder tests; not universal browser certification |
| `node --test tests/target-image.test.mjs` from frontend, repeated after final catalog copy | 4 passed | Quality-only compatibility, actual decimal-byte caps, unreachable targets, invalid inputs and encoder failures |
| Frontend `npm run lint` | 0 errors, 4 existing warnings | Warnings concern existing `<img>` usage in homepage, ImageSettings, InvoiceImporter and Workbench |
| Backend `.venv/Scripts/python.exe -m unittest discover -s tests -v` | 13 passed | Existing database configuration/model/migration and demo-auth tests; no production database service was certified |
| Production build | Passed; 540 static pages generated | Full npm build passed; final incremental Next build also passed after catalog description change |
| `git diff --check` | Passed | Only Git's existing LF/CRLF conversion notices; no whitespace errors |
| Inventory regeneration | 505 canonical tools, 145 aliases, 18 categories | Generated frontend/backend published snapshots synchronized; no tool IDs/routes removed |

The build used `NEXT_PUBLIC_SITE_URL=https://alltoolnexa.example` only in the build process environment. No environment file was edited and no site was deployed.

## Browser result

`frontend/scripts/verify-target-image.mjs` ran against the local frontend preview with installed Edge. A deterministic synthetic 256×256 PNG was selected through the real file input, the 20 KB preset chosen, JPEG selected, and compression executed.

* Output: 19,600 bytes, `image/jpeg`, 256×256 pixels.
* The measured output satisfies the decimal 20,000-byte cap.
* The download completed as `image-compressor.jpg`.
* At a 375×812 viewport there was no horizontal page overflow; the mobile screenshot was visually inspected.
* No POST, PUT or PATCH request was observed during file processing. This is evidence for this tested workflow, not all tools or all future sessions.
* A one-byte target produced a clear error and kept the previous downloadable result, marked stale after the edited input.

Local artifacts: [result JSON](../../frontend/runtime-results/target-image/result.json), [mobile screenshot](../../frontend/runtime-results/target-image/mobile.png), [desktop screenshot](../../frontend/runtime-results/target-image/desktop.png). They are ignored runtime artifacts rather than source assets. The temporary preview process was stopped after testing.

The browser result predates the final descriptive copy change; the processing code did not change after the successful run. Safari/Firefox, low-memory physical devices, main-thread-only fallback and all other file tools were not independently certified by this check.

## Research checks

The ledger contains exactly 32 distinct competitor URLs. Every referenced retained evidence file was checked to exist. Original captures, provider failures, recovered partial observations and web-reader summaries are kept separately. No failed capture was promoted to complete.

Initial homepage results: 30 content pages, one security challenge and one suspended service. Additional REA tool attempts: 8 complete interface captures, 5 partial interface captures with cleanup errors and 7 failed captures. Five further India tool pages were reviewed through the web reader; the selected SortMyPDF tool page was inaccessible to it. Photopea's editor was not opened beyond its landing page. Three sites expose initial conversion/file interfaces on their homepage.

Twelve official pricing pages were reviewed; unresolved dynamic amounts remain unknown. FreeConvert and Tinify API documentation was summarized separately from runtime observations. No competitor upload→processing→download workflow was certified. Competitor mobile/keyboard/accessibility certification and most runtime API payload contracts remain pending. This work is an initial audit and a tested incremental implementation, not completion of the broader production-ready platform objective.
