# User audit fixes

Date: 23 October 2026. Changes apply to the local source checkout; nothing was deployed.

| Audit | Change |
|---|---|
| UX-01 | Full clear discards inputs, result, preview, copy/download controls and result object URL. Reset remains input-only. |
| UX-02 | Unicode text PDF uses browser canvas rendering with grapheme-aware wrapping. Latin PDFs retain selectable text. Unicode watermarks render as images. Device fonts determine glyph coverage; this is not selectable Unicode font embedding. |
| UX-03 | Tool-specific report link and downloadable report form. No support email configured, as requested by the user. Reports are not sent or saved on a server. |
| UX-04–06 | Mobile menu includes all main routes; category selector replaces sideways filters; mobile directory cards use one column with full descriptions. |
| UX-07 | Bounded typo suggestions with tested `pdf marg` → PDF Merge recovery. |
| UX-08–09 | Category/search history entries and URL-backed Show more limit restore directory state. Scroll restoration still follows browser/Next behavior. |
| UX-10–11 | Task-specific buttons and labeled metric cards for simple object outputs; developer/raw outputs remain copyable/downloadable. Complex tables and domain-specific currency formatting remain future polish. |
| UX-12–13 | Numeric field checks, field-specific messages, aria-invalid/descriptions and metadata constraints. Unbounded numeric errors no longer expose Infinity. Domain engine errors still use the error summary; not every calculator has full per-field domain metadata. |
| UX-14–16 | Single-file limits, image pixel limits, rejected-replacement messaging, validation progress and cancellation. Cancel prevents adoption and stops the remaining queue after the current decode/read; it cannot interrupt every browser decoder mid-operation. |
| UX-17 | HTML-to-PDF instructions now respect noFile; timers have their own instructions. |
| UX-18 | Friendly unavailable-service state, retry and Continue using tools. Successful backend authentication was not tested. |
| UX-19–20 | Timer phase/deadline persists locally; edits to inactive phase do not stop active phase. Completion remains silent and next phase manual, explicitly disclosed. |
| UX-21 | Conversion limitations repeated beside inputs. Full Word/PDF layout reconstruction and editable PPTX conversion were not added. |
| UX-22 | Refresh/close and clicked-link navigation warn about unsaved work. No private drafts are persisted. Browser Back/Forward within the app is not fully intercepted by this guard. |
| UX-23 | Explicit maximum CGPA scale, range checks and rejection of percentages above 100. |
| UX-24 | README counts corrected, publishable inventory regenerated. |

## Verification

- Browser confirmed Word Counter generates readable metric cards; full clear removes the result and output actions.
- Engine regression suite: 459 tests, 458 passed, 1 skipped, 0 failed.
- Lint: 0 errors, 4 warnings (image optimization and an existing PDF preview effect-ref warning).
- Production build passed on final source (537 generated pages). Build uses `https://alltoolnexa.example` solely as a temporary verification origin, not a deployment or saved production configuration.
- Final production-browser checks passed: mixed Hindi/English text generated a PDF with a visible preview, mobile menu exposed all main links, the mobile category selector returned 25 PDF tools, editing break minutes kept focus running, and reloading resumed the timer. Initial browser timeouts were recovered by testing the local production server.
- All 85 browser-dependent tools have not been individually certified end to end. The original coverage ledger remains a record of the audit, not a post-fix universal PASS.

Screenshot: [mobile navigation after fixes](./audit-mobile-fixed.png).

## Remaining limits

Selectable Unicode/Indic PDF text, platform-independent fonts, full-fidelity document conversions, comprehensive per-tool field metadata, browser-history navigation guarding and exhaustive cross-browser checks are not claimed complete. The downloadable report is a local fallback, not a working support inbox.
