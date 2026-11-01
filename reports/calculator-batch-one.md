# Original calculator batch one

The user requested 20 tools after reviewing the audit and showing the deployed homepage. This batch implements 20 source-checked, nonduplicate calculator workflows. It does not assert that any tool is a verified competitor gap: live competitor research remains blocked. The 248 calculators previously reported already existed; the new count is **268 standalone calculators and 527 total tools**.

All tools use the existing Math & Numbers subcategory under Calculators & Utilities. No main category or backend calculation dependency is added. Physics and chemistry use this existing educational numeric subcategory rather than creating a new taxonomy. Each page has explicit SI units, a formula, model assumptions, a reproducible example, FAQs and related tools. Inputs and results remain together on desktop and stack on mobile. The existing local calculation, reset, copy and download workflow is reused.

| New calculator | Specification | Route |
| --- | --- | --- |
| Geometric Mean Calculator | [Specification](calculator-specifications/geometric-mean-calculator.md) | https://alltoolnexa.pages.dev/tools/geometric-mean-calculator |
| Harmonic Mean Calculator | [Specification](calculator-specifications/harmonic-mean-calculator.md) | https://alltoolnexa.pages.dev/tools/harmonic-mean-calculator |
| Z-Score Calculator | [Specification](calculator-specifications/z-score-calculator.md) | https://alltoolnexa.pages.dev/tools/z-score-calculator |
| Covariance Calculator | [Specification](calculator-specifications/covariance-calculator.md) | https://alltoolnexa.pages.dev/tools/covariance-calculator |
| Correlation Coefficient Calculator | [Specification](calculator-specifications/correlation-coefficient-calculator.md) | https://alltoolnexa.pages.dev/tools/correlation-coefficient-calculator |
| Linear Regression Calculator | [Specification](calculator-specifications/linear-regression-calculator.md) | https://alltoolnexa.pages.dev/tools/linear-regression-calculator |
| Kinetic Energy Calculator | [Specification](calculator-specifications/kinetic-energy-calculator.md) | https://alltoolnexa.pages.dev/tools/kinetic-energy-calculator |
| Potential Energy Calculator | [Specification](calculator-specifications/potential-energy-calculator.md) | https://alltoolnexa.pages.dev/tools/potential-energy-calculator |
| Force Calculator | [Specification](calculator-specifications/force-calculator.md) | https://alltoolnexa.pages.dev/tools/force-calculator |
| Pressure Calculator | [Specification](calculator-specifications/pressure-calculator.md) | https://alltoolnexa.pages.dev/tools/pressure-calculator |
| Density Calculator | [Specification](calculator-specifications/density-calculator.md) | https://alltoolnexa.pages.dev/tools/density-calculator |
| Acceleration Calculator | [Specification](calculator-specifications/acceleration-calculator.md) | https://alltoolnexa.pages.dev/tools/acceleration-calculator |
| Momentum Calculator | [Specification](calculator-specifications/momentum-calculator.md) | https://alltoolnexa.pages.dev/tools/momentum-calculator |
| Wavelength Calculator | [Specification](calculator-specifications/wavelength-calculator.md) | https://alltoolnexa.pages.dev/tools/wavelength-calculator |
| Torque Calculator | [Specification](calculator-specifications/torque-calculator.md) | https://alltoolnexa.pages.dev/tools/torque-calculator |
| Ohm's Law Calculator | [Specification](calculator-specifications/ohms-law-calculator.md) | https://alltoolnexa.pages.dev/tools/ohms-law-calculator |
| Electrical Power Calculator | [Specification](calculator-specifications/electrical-power-calculator.md) | https://alltoolnexa.pages.dev/tools/electrical-power-calculator |
| Transformer Calculator | [Specification](calculator-specifications/transformer-calculator.md) | https://alltoolnexa.pages.dev/tools/transformer-calculator |
| Molarity Calculator | [Specification](calculator-specifications/molarity-calculator.md) | https://alltoolnexa.pages.dev/tools/molarity-calculator |
| Mole Fraction Calculator | [Specification](calculator-specifications/mole-fraction-calculator.md) | https://alltoolnexa.pages.dev/tools/mole-fraction-calculator |

## Validation

- New formula suite: 141 tests passed, including five independent known-answer vectors for each of the 20 tools, default examples, invalid fields and undefined model cases.
- Full frontend suite: 702 passed, 5 skipped, no failures.
- Backend suite: 65 run, 5 skipped, no failures. The hierarchy count expectation now includes the 20 added tools; backend application and deployment workflow code are unchanged.
- Deployment helper suite: 15 passed.
- Offline audit integrity: 9 passed; new source coverage does not promote unverified competitor records into confirmed missing records.
- Production `npm run build` and Cloudflare `build:pages`: passed. All 20 exported pages have canonical sitemap entries, unit context and structured data.
- Targeted ESLint: no errors; the pre-existing generic image-preview warning remains.

Local browser checks use mocked shared session/availability APIs and real client-side formulas. They do not claim to verify a remote deployment or a live backend session. Per-tool specifications and test vectors are reproducible with `node scripts/calculator-audit/specifications.mjs`.

Final browser run: **60/60 checks passed**, covering all 20 calculators at 320px, 390px and 1440px: route status, canonical URL, actual default calculation, visible result units, retained inputs, mobile stacking/desktop columns, overflow, reset and clear behavior. Script: `frontend/scripts/verify-science-calculators.mjs`.
