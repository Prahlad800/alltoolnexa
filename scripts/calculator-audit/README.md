# Calculator audit tooling

Run from the repository root after installing frontend dependencies:

```sh
node scripts/calculator-audit/export-existing.mjs
python scripts/calculator-audit/build_reports.py
python -m unittest discover -s scripts/calculator-audit -p 'test_*.py' -v
```

Requires the project's Node environment, installed `frontend/node_modules/acorn` and Python 3 (standard library only). These commands do not fetch competitor pages. They extract the live source registry, combine manually reviewed candidate coverage with four retained historical observations, and write explicitly incomplete reports.

`coverage.py` is analyst-maintained source coverage, not automatic proof that a tool is missing. `candidates.tsv` preserves the user's 143 proposed purposes. `evidence.py` reads retained public-page observations without executing their scripts. `build_reports.py` records the denied network probes as audit evidence, not as a fresh network test. Update its network state only after actually verifying changed access. Unknown totals must remain null and unavailable metadata must remain unverified.

Do not rerun the scripts and describe the output as a completed competitor census. Resume official listing/page research only after access is permitted and robots/terms are checked. See `reports/calculator-implementation-readiness.md` for the implementation admission gate.

Initial baseline validation on 2026-11-01 (before the subsequent 20-tool batch; see `reports/calculator-batch-one.md` for the current inventory):

- Audit integrity suite: 9 passed (counts, candidate preservation, source hashes, URL provenance, partial-capture handling, missing-export uncertainty, parser filtering and report links).
- `node --test shared/tools.test.mjs shared/reference-tools.test.mjs` from `frontend`: 439 passed.
- All 248 inventoried standalone calculator defaults evaluated successfully.
- Root `npm run build` with `NEXT_PUBLIC_SITE_URL=https://alltoolnexa.pages.dev NEXT_TELEMETRY_DISABLED=1`: passed.

These checks validate the existing source and bounded reporting process. They do not replace formula-specific testing for future calculators or live competitor verification.
