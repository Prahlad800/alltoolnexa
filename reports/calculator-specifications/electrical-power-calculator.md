# Electrical Power Calculator

Slug: `electrical-power-calculator`
Main category: Calculators & Utilities
Subcategory: Math & Numbers
Priority: User-authorized initial batch
Purpose/output: DC power (W).
Competitor references: UNVERIFIED. This original implementation is not represented as a confirmed competitor gap.

## Required inputs

Units are explicit in the labels. No optional inputs or currency.

| Key | Label and unit | Type | Minimum | Maximum | Default | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| voltage | Voltage magnitude (V) | number | 0 | 1e+100 | 12 | Required finite numeric value within bounds. |
| current | Current magnitude (A) | number | 0 | 1e+100 | 2 | Required finite numeric value within bounds. |

## Mathematical logic and calculation steps

P = VI for DC electrical power.

1. Parse each required input and enforce finite values, field bounds and model-domain checks.
2. Apply the formula above in browser JavaScript; no API request.
3. Reject nonfinite results and round presentation to 12 significant digits. Keep units in the result context.

This is a DC model using voltage and current magnitudes. AC real power additionally requires power factor and phase information and is not calculated here.

## Outputs

DC power (W). Regression returns slope, intercept and observation count; all other tools return a scalar.

## UI and mobile layout

Use the shared labelled form, Calculate and Reset/Clear controls and result card. On desktop keep form and results together; stack on mobile with no horizontal overflow. Below the calculator show the formula, model explanation, default-input worked example, original FAQs and related tools.

## Validation and numeric limits

Reject blank, NaN, infinity and values outside field bounds. Reject zero denominators, nonpositive inputs where the formula requires positivity, unsupported selector values and mismatched paired series. Dataset values are bounded at magnitude 1e100 and lists at 1,000 observations. Turns require safe positive integers. Negative values are accepted only where meaningful (signed velocity/acceleration/height, observed data and means). Very small nonzero denominators that overflow are rejected. JavaScript floating-point arithmetic is approximate; do not claim exact decimal arithmetic. Geometric mean uses logs, harmonic mean uses minimum-value scaling, and correlation normalizes without multiplying variances.

## SEO

Title/H1: Electrical Power Calculator
Meta description: Electrical Power: dc power (w). Calculate locally with explicit inputs and assumptions.
Canonical: https://alltoolnexa.pages.dev/tools/electrical-power-calculator
H2: How to use; Common questions; Related tools.
Formula, explanation and reproducible worked example are rendered from registry data. Existing WebApplication, BreadcrumbList and FAQPage structured data are retained.
FAQs: What units should I enter? What assumptions apply? Answers use the field units and model explanation above.
Related: ohms-law-calculator, watt-to-unit-calculator.

## Five independent expected-result cases

1. Input: `{"voltage":12,"current":2}` → expected: `24`.
2. Input: `{"voltage":0,"current":2}` → expected: `0`.
3. Input: `{"voltage":12,"current":0}` → expected: `0`.
4. Input: `{"voltage":0.5,"current":3}` → expected: `1.5`.
5. Input: `{"voltage":230,"current":10}` → expected: `2300`.

In addition, the automated suite checks missing/invalid numeric fields, nonfinite values, bounds, invalid lists and model-specific undefined cases. Relative answer tolerance is 1e-10 with an absolute floor of 1e-12.
