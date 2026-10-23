# Document workspaces

Added on 23 October 2026. All workspaces process selected files in the browser.

| Workspace | Route | Working features |
| --- | --- | --- |
| PDF Editor | `/tools/pdf-editor` | Text overlays, highlight, drawing, visual white cover, undo, reorder/rotate/delete pages, download edited PDF |
| Invoice Generator | `/tools/invoice-generator` | Structured invoice totals and PDF, HTML, XLSX, CSV, PNG, JPEG, JSON or all-format ZIP export |
| Invoice Converter | `/tools/invoice-converter` | Selectable PDF text extraction, photo/scanned-page OCR, review/edit text, HTML/XLSX/CSV/TXT/JSON/PDF/photo/ZIP export |
| Spreadsheet Editor | `/tools/spreadsheet-editor` | Workbook tabs, formula bar, formatting ribbon, keyboard navigation, undo/redo, sorting, filter, fill, find/replace, supported file import/export |

## PDF scope

Edits add content over original pages. Original selectable text and page graphics are retained. Existing text is not rewritten. White cover is visual covering, **not secure redaction**. Crop and OCR are not part of this editor. Unicode overlays render through browser fonts.

## Both invoice flows

Use Invoice Generator to create structured invoices from entered line items. Use Invoice Converter for existing PDFs/photos. Extracted text must be reviewed; financial columns and original page layout are not reconstructed automatically. Imported XLSX/CSV output contains line positions and literal reviewed text, rather than inferred totals or accounts. Generated invoice XLSX contains structured typed data.

Photo OCR supports English, Hindi or both. Its engine and language models download from public hosts on first use; recognition takes place locally. OCR needs a connection for those downloads and accuracy depends on the input. Converter limits: one file up to 20 MB, at most 10 PDF pages, up to 100,000 reviewed characters. PDF/photo exports of reviewed text render through canvas; that PDF text is image based.

## Spreadsheet scope

Import `.xlsx`, `.csv`, `.tsv`, or workspace `.json`; export XLSX, CSV, TSV, HTML or JSON. CSV/TSV export the active sheet's calculated values. JSON preserves the full supported workspace model. Keep the original Excel file: XLSX export preserves the implemented subset and does not retain every Excel feature.

Limits are 10,000 rows × 256 columns per sheet, 20 sheets, and 100,000 populated/styled cells per workbook. XLS is unsupported. Supported formulas are listed directly in the Formulas ribbon from `SUPPORTED_FUNCTIONS` in `src/lib/sheet-model.mjs`. The parser does not use `eval`; unsupported formulas return stable errors. Supported styles include font family/size, bold/italic/underline, text/fill colors, alignment, wrap, cell borders, numeric/currency/percent/date/time/scientific formats and decimals.

The Shortcuts ribbon lists implemented keys. Shortcuts operate while the grid has focus; browser/OS reserved keys can take priority. Native text-edit shortcuts remain available while editing. Internal copy adjusts relative formula references; cut/paste does not rewrite other cells' references. Sorting moves formulas as written. Structural row/column edits update supported references, clear merges on that sheet, and return `#REF!` for a deleted reference or range endpoint rather than Excel's full range-shrinking behavior. Rename sheets before cross-sheet formulas are created.

Macros, pivot tables, charts, tables, collaboration, external workbook links, rich conditional formatting, shared formula expansion and full Excel formula/shortcut parity are outside this implementation. Data remains in the tab until downloaded; no automatic workbook persistence is provided. Desktop and mobile use the same local processing code; the grid scrolls within its own viewport. Large sheets display in 100-row / 26-column windows with paging and direct cell navigation. Selection statistics use the first 1,000 selected cells when a larger range is selected. Formula ranges have a separate 10,000-cell computation limit.

## Verification

Automated tests cover formula errors/cycles/lazy branches, references, typed XLSX XML, escaping, CSV formula injection, styles/merges/dimensions, structural edits, invoice totals/export, and original PDF page retention. Opt-in browser checks exercise real Chrome DOMParser XLSX import, PDF upload/edit/download and spreadsheet UI. OCR and canvas/download checks require a browser and model network access; see the optional/manual test scripts under `frontend/tests`.

Reference observation and its limits are recorded in [EXCEL-REFERENCE-EVIDENCE.md](EXCEL-REFERENCE-EVIDENCE.md).

Run regular checks with `npm test` and `npm run lint` in `frontend`. With the local frontend running, opt-in browser checks use PowerShell:

```powershell
$env:SHEET_BROWSER_TEST='1'
node --test tests/sheet-files.test.mjs
$env:SHEET_UI_TEST='1'
node --test tests/sheet-editor-browser.test.mjs
node tests/invoice-e2e.manual.mjs
```

The default test run skips browser-only checks and does not download OCR models. The invoice manual test uses synthetic data and the actual public OCR model hosts.

Verified on 23 October 2026: frontend default suite 507 passed, 5 skipped (including opt-in browser checks); backend 13 passed; frontend production build generated all 540 pages using a temporary test HTTPS origin; admin production build passed. Separate Chrome checks passed PDF upload/edit/download, spreadsheet desktop/mobile/clipboard/XLSX round trip, 1,000-row CSV navigation and actual English photo OCR/invoice downloads. Edge independently passed the 1,000-row import and A800/A1000 navigation check. Firefox and Safari were not tested. The three local services and login/logout/access protection were also verified.
