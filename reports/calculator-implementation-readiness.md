# Calculator implementation readiness

**Requested batch: 20. Approved-by-evidence selection: none yet. Status: blocked on competitor verification.**

No calculator application code has been changed. This follows the explicit research-before-implementation requirement. Candidates with no dedicated project workflow remain candidates, not certified competitor gaps.

## Admission gate for each implementation

1. Verify an actual official listing and destination page under permitted access; record date, URL and evidence scope.
2. Inspect existing runner code and its fields/outputs, including aliases and embedded workbook functions. Record one of the six required statuses.
3. Confirm MISSING rather than a differently named, equivalent or partial existing feature. Partial tools enter an extension queue.
4. Write a complete original specification: required/optional fields, typed units, bounds/defaults, finite/range/zero-denominator checks, formula with definitions and assumptions, calculation steps and output precision.
5. Include an accessible form, reset, result card, formula, worked example, explanation, FAQs, related canonical tools, mobile behavior, metadata/canonical path and appropriate structured data.
6. Attach at least five independent expected-result and edge-case tests. Cover empty, zero, negative, extreme and decimal inputs where meaningful; check an independent numerical oracle for advanced distributions/solvers.
7. Rank only the confirmed missing pool; select 20 in small reviewable batches, using current JavaScript/Next.js conventions and existing helpers.
8. Run targeted calculator tests, the existing suite, lint, production/static build and 320/390/desktop browser checks; ensure discovery/search, category counts, schema and sitemap remain consistent.

## Merge/extension cautions already identified

- Vehicle, education, business and fixed-rate equity-loan payments share the existing EMI engine. Verify domain-specific extras before making pages.
- Prefer an extended percentage form over another basic percentage implementation.
- Add recurring extra-payment modes to existing repayment/prepayment tools if verified.
- Review polynomial/synthetic division as modes of one operation, pre/post-money as a paired valuation solver, and AdSense/YouTube as manual-RPM scenarios before deciding on separate canonical tools.
- Clinical calculators require specialist review. Tax/pension rules, atomic data, emission factors and AI water-use models require dated authoritative references. Do not fabricate universal defaults.

## Resume commands

```sh
node scripts/calculator-audit/export-existing.mjs
python scripts/calculator-audit/build_reports.py
python -m unittest discover -s scripts/calculator-audit -p "test_*.py" -v
```

These commands regenerate and validate only the available-evidence report. They do not fetch blocked sites, complete the census, verify formulas automatically or implement calculators. Input source annotations must be reviewed when new evidence arrives.
