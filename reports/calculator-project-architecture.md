# AllToolNexa calculator architecture audit

Initial audit source revision: `d6fa476dee6e03b591ac4c79b2a85effdfd6e41f`. This is a repository audit, not a claim that the deployed site was inspected. Live access is blocked; see [the comparison summary](calculator-comparison-summary.md).

## Framework and routing

The frontend uses Next.js 16 App Router, React 19, JavaScript ES modules and npm. Keep this architecture rather than introducing a parallel TypeScript calculator application. `frontend/src/app/tools/[slug]/page.js` generates tool routes from the shared registry, handles canonical aliases and builds page metadata. `frontend/src/lib/site.js` supplies site URL and SEO helpers. Static deployment uses `frontend/scripts/build-pages.mjs`; the root build delegates to the frontend.

## Registry and calculations

`frontend/shared/catalog.mjs` owns `tools`, `register`, `evaluate`, `defaults`, `resolveTool` and aliases. The registry is extended by `science-calculators.mjs`, `extended.mjs`, `batch-two.mjs`, `reference-tools.mjs`, `reference-files.mjs`, `reference-browser.mjs`, `reference-extras.mjs` and `templates.mjs` in the same directory. Registration combines field definitions, a mathematical method, an evaluator and optional behavior. The method text alone does not establish functional equivalence: inspect the evaluator and outputs as well.

`frontend/shared/core.mjs` provides finite-number validation, required/range checks, positive/nonzero/integer helpers, bounded numeric lists, rounding, GCD and strict UTC date helpers. Simple calculations run in the browser. New formulas should remain independently testable through `evaluate`, with no backend/API dependency.

The generated [complete registry inventory](calculator-audit-data/existing-tool-inventory.json) includes every tool's category, fields, aliases, method and registration locations. Source hashes anchor this audit to the files actually inspected. The [calculator subset](existing-calculators.json) contains 268 standalone numerical/calendar calculators, including numeric and date converters. All 268 default evaluations succeeded. The count includes the later 20-tool original batch; see [batch details](calculator-batch-one.md). This is smoke coverage, not proof of all formulas or boundary cases. Spreadsheet and invoice workspaces are recorded separately as two embedded calculation workflows; the remaining registry tools are not counted as standalone calculators.

The spreadsheet supports SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, IFERROR, ROUND, ABS, AND, OR, NOT, LEFT, RIGHT, LEN, TRIM, UPPER, LOWER, CONCAT, COUNTIF and SUMIF. Its generic grid is not evidence of dedicated matrix, regression or IRR functionality.

## UI, validation and search

`frontend/src/components/Workbench.js` renders registry fields and results, with shared validation behavior in `frontend/src/lib/workbench-ux.mjs`. Existing controls have accessible labels, field errors, clear/reset actions and copy/download output. The generic workflow changes from form entry to a result/review state; the new science batch opts into retaining the input form beside its result using `retainInputs`, while other tools keep their existing workflow. Do not assume the current generic component already implements every requested desktop layout detail.

`frontend/src/app/globals.css` contains the existing responsive design tokens and light/purple visual language. Reuse existing controls, cards and responsive rules. Keep units visible in labels and results, avoid horizontal mobile overflow, and validate both field constraints and mathematical domain constraints.

`frontend/src/lib/search.mjs` powers tool discovery using registry names and search terms/aliases. Add a tool to the actual registry rather than maintaining a second search inventory. Synonyms for existing functionality should become search terms or aliases where appropriate, not duplicate calculators.

## Taxonomy

`frontend/shared/taxonomy.mjs` defines five main categories and 18 subcategories. Preserve these main categories:

| Main category | Existing subcategory IDs |
| --- | --- |
| PDF & Image Tools | pdf, image, design |
| Documents & Education | templates, text, student |
| Developer & QR Tools | developer, random, qr |
| Business & SEO Tools | seo, marketing, finance, office |
| Calculators & Utilities | math, converters, date-time, india, home |

Use finance for financial calculators, marketing for SaaS/marketing metrics, office for workplace metrics, math for mathematical/statistical calculations, converters for unit conversion, and home for suitable household/material estimates. Physics, chemistry and ecology currently have no dedicated subcategory. Their eventual placement needs an explicit taxonomy decision within the existing main categories; this audit does not silently add categories.

## SEO and localization

The tool route provides canonical metadata, breadcrumbs, WebApplication and FAQPage structured data, method/example content and related tools. Related tools currently come from the same registry category. A new calculator still needs a unique original description, domain-specific explanation, worked example and accurate FAQs; generic generated copy does not satisfy the requested detailed specifications. `frontend/src/app/sitemap.js` builds the sitemap from site routes and registry data.

`frontend/src/components/LanguageProvider.js` integrates i18next/react-i18next. English/Hindi are the free UI locales, additional UI locales have premium access checks, and admin remains English. Keep calculator labels compatible with this infrastructure. This source audit does not establish translated scientific explanations for new tools.

## Verification and extension sequence

The project uses Node's built-in test runner: `npm --prefix frontend test`. Formula tests are in `frontend/shared/tools.test.mjs` and `frontend/shared/reference-tools.test.mjs`; browser/workspace tests live under `frontend/tests`. ESLint and Next build are available, with HTTP/browser verification scripts for exported pages.

Before each implementation batch: verify competitor evidence and existing behavior, select genuinely missing functionality, write the requested per-tool specification and at least five meaningful expected-result/domain tests, register the original evaluator and metadata, then verify routing, aliases, search, units, mobile layout and build. Extend partial matches rather than registering duplicate tools. Follow `frontend/AGENTS.md` and the bundled Next.js documentation before runtime edits.

## Reproducing this bounded audit

From the repository root:

```sh
node scripts/calculator-audit/export-existing.mjs
python scripts/calculator-audit/build_reports.py
python -m unittest discover -s scripts/calculator-audit -p 'test_*.py' -v
```

These commands make no competitor network requests. They preserve historical evidence as historical, leave unknown totals null, and do not promote candidate gaps into confirmed missing calculators. The network section records the observed denied probes; after environment access changes, collect new live evidence and replace that state explicitly rather than treating these offline commands as a fresh network check.
