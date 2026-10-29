# Free browser Code Studio

Open `/code-editor`, linked from the public header, All tools page, homepage and footer. The workspace is free without an account. On phones, Editor and Output tabs keep controls usable; desktop shows both panels side by side.

HTML/CSS/JavaScript share a three-file project with an explicit Run preview, console messages and ZIP export. The iframe allows scripts but has an opaque sandbox origin, no parent-document access, and a restrictive CSP that blocks external connections. Inline HTML script elements are inert; use `script.js` for JavaScript. Network-hosted fonts, images, scripts and external libraries are intentionally outside this local preview.

Standalone JavaScript runs in QuickJS; Python uses CPython 3.11.3; C/C++ compile with Clang/LLD 8 and the bundled WASI standard libraries (C11/C++17). These are browser runtimes, not Node.js or a full native operating system. There is no pip/npm package installation. Standard input is supplied before running. Code, virtual files, inputs and outputs stay on the user's device; there is no execution API or backend change.

Each execution uses a fresh dedicated Worker. Stop terminates it. A 60-second timeout includes download/compilation, output is limited to 100,000 characters, each source to 100,000 characters and stdin to 16,000 characters. New runs and language changes discard old workers/results. Browser/device memory still limits large programs. Drafts are stored locally; source/project download remains available when local storage is unavailable.

## Reproducible static hosting

`npm ci` then `npm run build` (or `npm run build:pages`) prepares the runtime assets through the existing vendor preparation hook. `curl` is required on the build host. The build downloads six immutable upstream files from the Runno commit in `shared/code-runtime-manifest.mjs`, verifies original sizes/SHA-256, compresses WASM files, and bundles the WASI Worker with esbuild. Verified generated files are retained under ignored `public/vendor/code-runtime`. Existing assets are revalidated and reused; no language binaries are committed.

Compressed assets are below the 25 MiB Cloudflare Pages per-file limit (largest about 11 MB). Only the selected runtime downloads when Run is pressed: approximately 19 MB for C/C++, 14 MB for Python and 1.3 MB for JavaScript. Assets are served by the website itself; browsers do not depend on a third-party execution service. The Worker uses synchronous WASI stdin with pre-supplied input, so SharedArrayBuffer and site-wide COOP/COEP header changes are unnecessary. Standard Next.js and static export builds both support the workspace.

The dependency lockfile and runtime SHA-256 manifest must be updated deliberately when upgrading runtimes. Preserve verification. License notices: `public/licenses/code-runtime.txt` and the dependency packages' licenses.

## Validation

- `npm test`: saved-state validation, preview construction/injection boundaries and virtual filesystem archive handling, alongside the existing tool suites.
- `npm run lint` and `npm run build`.
- With a site running, from `frontend`: `AUDIT_ORIGIN=http://127.0.0.1:3102 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-code-editor.mjs`. Omit the executable variable to use Playwright's installed browser. This runs real HTML/CSS/JS interaction, all four console runtimes, C/C++/Python stdin, compiler/runtime errors, infinite-loop Stop, output limits, local draft restoration and ZIP/source downloads on 320px, 390px and 1440px. Results/screenshots go to ignored `runtime-results/code-editor`.
