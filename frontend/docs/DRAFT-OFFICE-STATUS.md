# Draft Office: reference UI release

Updated 25 October 2026. This release implements the user's rename and editor UI/UX request using the supplied Draft Office references. The master prompt and shortcut table describe a larger roadmap; they are not a claim that all those features exist.

## Routes and existing data

- `/draftsheet`: DraftSheet, previously PKExcel. `/pkexcel` redirects here.
- `/draftword`: DraftWord, previously PKWord. `/pkword` redirects here.
- `/office`: workspace entry page.
- Previous local drafts remain recoverable. The new keys are `alltoolnexa.draftsheet.v1` and `alltoolnexa.draftword.v1`, with fallback reads of the previous `pkexcel.v1` and `pkword.v1` keys. Original keys are not deleted.

## Current feature coverage

| Area | Status | Practical boundary |
| --- | --- | --- |
| Branded compact header, filename, save status, command search | Implemented | Registry contains supported editor actions only. Guest drafts are local, not cloud files. |
| Ribbon, themes, formula bar, sheets, status, collapse | Implemented | Browser and OS shortcut conflicts remain possible. |
| DraftSheet editing, formatting, undo, sorting/filter, formulas | Partial | Existing bounded spreadsheet engine; 22 supported functions. Sort/rename/reference limitations are displayed in the editor. |
| Sales workbook template | Implemented | Three sheets; editable formulas and currency styles. |
| Range chart | Partial | Numeric last column, labels first column, up to 24 rows; values update live. Chart is a local view, not exported in XLSX. |
| XLSX/CSV/TSV/JSON/HTML spreadsheet import/export | Partial | Existing adapters. Unsupported workbook features are not retained. Keep original files. |
| DraftWord formatting, lists, tables, pictures, DOCX/TXT import/export | Partial | Existing contenteditable editor and supported DOCX subset. Advanced layout and arbitrary round trips are not supported. |
| Heading outline | Implemented | Live h1/h2/h3 navigation. |
| Document notes | Partial | Local document-level notes; not range-anchored, shared or exported to DOCX. |
| Local named version history | Implemented | Up to 8 manually named versions per app, browser storage permitting. Explicit confirmation before restore. |
| Autosave and Ctrl+S | Partial | Local browser storage; sheet command applies in grid scope. Word saves in document scope. Export is a separate action. |
| Shortcut help | Partial | Help lists existing bindings; the full proposed 115-binding roadmap is not implemented. |
| Share button | Availability information | Explains export-and-share workflow. No cloud links, permission service or live collaboration. |
| Cloud workspace library, permissions, collaboration, shared comments | Planned | Requires persistence/auth/collaboration implementation. |
| Word structured engine, measured pagination, tracked changes, citations | Planned | Current editor is not a full structured document engine. |
| Pivot tables, extended functions, Power Query, macros | Planned/unsupported | No desktop Office parity claim. Imported VBA is not executed. |
| Full benchmark, multilingual/IME, assistive-technology audit | Not yet complete | No full-suite performance or accessibility certification. |

## Keyboard behavior

DraftSheet retains the existing grid shortcut handler, Ctrl+F1 ribbon toggle and shortcut-help tab/dialog. Ctrl+S now saves the local guest draft in office grid scope; exports have visible buttons. DraftWord retains browser-native editing shortcuts plus scoped Ctrl+S, Ctrl+O and Ctrl+F1. Composition/AltGr input is not treated as a command. Filename/search/note fields do not route formatting shortcuts to the document.

## Verification

Run `node scripts/check-draft-office.mjs` with the local server running. It covers redirects, local draft recovery, sales formulas, chart updates, XLSX download, outline/notes, named versions and DOCX download. It does not certify every roadmap requirement or full Office compatibility.
