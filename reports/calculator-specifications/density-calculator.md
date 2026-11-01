# Density Calculator

Slug: `density-calculator`
Main category: Calculators & Utilities
Subcategory: Math & Numbers
Priority: User-authorized initial batch
Purpose/output: Density (kg/m³).
Competitor references: UNVERIFIED. This original implementation is not represented as a confirmed competitor gap.

## Required inputs

Units are explicit in the labels. No optional inputs or currency.

| Key | Label and unit | Type | Minimum | Maximum | Default | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| mass | Mass (kg) | number | 0 | 1e+100 | 2 | Required finite numeric value within bounds. |
| volume | Volume (m³) | number | 0 | 1e+100 | 0.001 | Strictly greater than zero. Required finite numeric value within bounds. |

## Mathematical logic and calculation steps

ρ = m/V, with mass m in kg and volume V > 0 in m³.

1. Parse each required input and enforce finite values, field bounds and model-domain checks.
2. Apply the formula above in browser JavaScript; no API request.
3. Reject nonfinite results and round presentation to 12 significant digits. Keep units in the result context.

Bulk density is mass divided by measured volume. Temperature, porosity and material composition can affect actual measurements; no material density is assumed.

## Outputs

Density (kg/m³). Regression returns slope, intercept and observation count; all other tools return a scalar.

## UI and mobile layout

Use the shared labelled form, Calculate and Reset/Clear controls and result card. On desktop keep form and results together; stack on mobile with no horizontal overflow. Below the calculator show the formula, model explanation, default-input worked example, original FAQs and related tools.

## Validation and numeric limits

Reject blank, NaN, infinity and values outside field bounds. Reject zero denominators, nonpositive inputs where the formula requires positivity, unsupported selector values and mismatched paired series. Dataset values are bounded at magnitude 1e100 and lists at 1,000 observations. Turns require safe positive integers. Negative values are accepted only where meaningful (signed velocity/acceleration/height, observed data and means). Very small nonzero denominators that overflow are rejected. JavaScript floating-point arithmetic is approximate; do not claim exact decimal arithmetic. Geometric mean uses logs, harmonic mean uses minimum-value scaling, and correlation normalizes without multiplying variances.

## SEO

Title/H1: Density Calculator
Meta description: Density: density (kg/m³). Calculate locally with explicit inputs and assumptions.
Canonical: https://alltoolnexa.pages.dev/tools/density-calculator
H2: How to use; Common questions; Related tools.
Formula, explanation and reproducible worked example are rendered from registry data. Existing WebApplication, BreadcrumbList and FAQPage structured data are retained.
FAQs: What units should I enter? What assumptions apply? Answers use the field units and model explanation above.
Related: pressure-calculator.

## Five independent expected-result cases

1. Input: `{"mass":2,"volume":0.001}` → expected: `2000`.
2. Input: `{"mass":0,"volume":1}` → expected: `0`.
3. Input: `{"mass":1,"volume":1}` → expected: `1`.
4. Input: `{"mass":0.5,"volume":2}` → expected: `0.25`.
5. Input: `{"mass":1000,"volume":2}` → expected: `500`.

In addition, the automated suite checks missing/invalid numeric fields, nonfinite values, bounds, invalid lists and model-specific undefined cases. Relative answer tolerance is 1e-10 with an absolute floor of 1e-12.
