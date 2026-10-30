# AllToolNexa Code Studio

Open `/code-editor`. The desktop workspace has a file explorer, folders, closable tabs, a syntax editor, terminal/stdin and an isolated preview. Phones have Files, Editor, Run, Preview and Console controls. The site's ordinary mobile navigation is hidden on this route so it does not cover the workspace controls. Projects support creation, rename and deletion of files, empty folders, file/content search, formatting for supported types, source downloads, ZIP import/export and local draft saving. Import explicitly replaces the open project after offering a backup download.

## Access and language catalog

The 13 free Phase 1 types are HTML, CSS, JavaScript, JSX, TypeScript, TSX, Python, C, C++, Java, JSON, Markdown and TXT. Free types work without signup. The catalog contains 76 entries across web development, programming, database/query languages and documents/data, including every requested framework and SQL dialect. The remaining 63 entries require Premium or Premium Plus. Basic and Pro keep the free catalog.

React, Next.js, Vue and Angular entries are source presets, not separate programming languages. Free JSX/TSX still support React component previews. Framework presets do not provide a server process or framework CLI. SQL files do not connect to a database.

Access comes from the existing uncached `/api/me` endpoint, with both the `is_premium` flag and the Premium/Premium Plus plan checked. Local storage, ZIP manifests and source contents cannot grant access. Premium selection, new files, rename and formatting check the server; execution rechecks access and checks imported module languages too. Auth/focus refresh and a visible-page 60-second refresh detect expiry. Failure to verify falls back to Free. Restored premium files become read-only on expiry and remain downloadable, preserving paid users' drafts. This is a local browser editor: the client feature gate is not DRM or a server-side code execution boundary. No execution endpoint or backend/schema/pipeline changes are introduced.

## Editing and execution capabilities

| Types | Behavior |
| --- | --- |
| HTML/CSS/JS project | Local website preview, linked local scripts/styles, inline scripts and console messages |
| JSX/TSX, React source presets | Locally bundled React component preview, hooks and static relative JS/TS/JSX/TSX/JSON/CSS imports |
| JavaScript, TypeScript | QuickJS console runner; TypeScript is transpiled without type checking |
| Python | CPython 3.11.3 browser WASI runner |
| C/C++ | Clang/LLD 8 with bundled WASI libraries, C11/C++17 |
| JSON, JSON Lines, XML, notebook JSON | Syntax/structure validation; notebook cells do not execute |
| Markdown, SVG | Sanitized document/graphic preview |
| Java and other catalog entries | Editing, highlighting and export; Run is disabled with an Editing only label |

CodeMirror lazily loads dedicated parsers where available. Less common syntaxes use a basic token highlighter; plain text/data types remain text. This is not a language server, debugger, hosted shell, full VS Code installation or AI assistant. Browser runners execute the active entry with standard libraries; C/Python multi-file builds, npm/pip, external packages and server processes are unavailable. Download source to use these in a normal development environment.

The iframe has an opaque sandbox origin (`allow-scripts` only) and a restrictive CSP blocking outside connections, parent-document access and form submission. JavaScript is added as script text, never interpolated into HTML. Markdown/SVG are sanitized. Static project imports are resolved locally; outside packages, traversal and dynamic imports are rejected. Preview code runs only when Run/Refresh is pressed. Stop removes the preview; the 60-second timeout applies to Worker programs, not to browser-page JavaScript.

## Drafts, import and limits

Drafts use `alltoolnexa-code-studio-v2`; the old v1 draft is migrated with all independent sources and stdin retained, without deleting the original key. Projects have up to 50 files, 50 explicit folders, 100,000 characters per file and 1,000,000 total source characters. Standard input is limited to 16,000 characters; runner output to 100,000. Each Worker run is fresh; Stop terminates it and a 60-second deadline includes loading/compilation. Device memory remains a limit.

ZIPs include exact source contents and `alltoolnexa.studio.json` metadata for paths, language dialects, selected tabs and folders. Imports validate paths, UTF-8, sizes, extensions and access before replacing the current project. Compressed entries are read with bounded output. Unknown/binary types and traversal are rejected. Download remains available if local storage or plan verification fails. There is no cloud sync for these drafts.

## Static hosting

Run `npm ci`, then `npm run build` or `npm run build:pages`, with `NEXT_PUBLIC_SITE_URL` configured. The vendor hook requires curl. Six immutable Runno upstream files are verified against the existing sizes/SHA-256 manifest, compressed and served from ignored `public/vendor/code-runtime`. React is bundled from the pinned local React dependencies into `public/vendor/code-preview-react.js`; the preview has no CDN dependency.

No language binaries are committed. Assets remain below the Cloudflare Pages 25 MiB file limit. Language runtimes download only on Run: about 19 MB for C/C++, 14 MB for Python and 1.3 MB for JavaScript. SharedArrayBuffer and global COOP/COEP changes are unnecessary. Runtime license notices remain in `public/licenses/code-runtime.txt`; editor/parser, Sucrase, Acorn and React licenses are supplied by their npm packages.

## Validation

Run `npm test`, `npm run lint` and `npm run build`. Serve the site or the static output and run from `frontend`:

```sh
AUDIT_ORIGIN=http://127.0.0.1:3104 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-code-studio.mjs
```

The old `verify-code-editor.mjs` command delegates to this audit. Default widths are 320, 390, 834 and 1440; `AUDIT_WIDTHS` can select a subset. `AUDIT_SMOKE=1` skips the C/C++/Python runner and cancellation cases when checking subsequent layout changes; it retains real JS/TS execution, previews and account/file tests. Browser tests use real local runtimes, interactive React, stdin, compiler errors, cancellation/output limits, downloads and ZIP imports. Only account APIs are mocked for deterministic free/premium/expired/unavailable scenarios. Results and screenshots go to ignored `runtime-results/code-studio`.
