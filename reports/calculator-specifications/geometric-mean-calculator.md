# Geometric Mean Calculator

Slug: `geometric-mean-calculator`
Main category: Calculators & Utilities
Subcategory: Math & Numbers
Priority: User-authorized initial batch
Purpose/output: Geometric mean (same unit as the data).
Competitor references: UNVERIFIED. This original implementation is not represented as a confirmed competitor gap.

## Required inputs

Units are explicit in the labels. No optional inputs or currency.

| Key | Label and unit | Type | Minimum | Maximum | Default | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| text | Positive values (comma or space separated) | textarea | 2 observations | 1,000 observations | 1, 4, 16 | Required finite numeric list, 2–1,000 values; magnitude ≤ 1e100. |

## Mathematical logic and calculation steps

G = exp(Σ ln(xᵢ) / n), where every xᵢ > 0.

1. Parse each required input and enforce finite values, field bounds and model-domain checks.
2. Apply the formula above in browser JavaScript; no API request.
3. Reject nonfinite results and round presentation to 12 significant digits. Keep units in the result context.

Use the geometric mean for positive multiplicative measurements. Logarithms avoid overflow from multiplying the observations. Zero and negative observations are outside this model.

## Outputs

Geometric mean (same unit as the data). Regression returns slope, intercept and observation count; all other tools return a scalar.

## UI and mobile layout

Use the shared labelled form, Calculate and Reset/Clear controls and result card. On desktop keep form and results together; stack on mobile with no horizontal overflow. Below the calculator show the formula, model explanation, default-input worked example, original FAQs and related tools.

## Validation and numeric limits

Reject blank, NaN, infinity and values outside field bounds. Reject zero denominators, nonpositive inputs where the formula requires positivity, unsupported selector values and mismatched paired series. Dataset values are bounded at magnitude 1e100 and lists at 1,000 observations. Turns require safe positive integers. Negative values are accepted only where meaningful (signed velocity/acceleration/height, observed data and means). Very small nonzero denominators that overflow are rejected. JavaScript floating-point arithmetic is approximate; do not claim exact decimal arithmetic. Geometric mean uses logs, harmonic mean uses minimum-value scaling, and correlation normalizes without multiplying variances.

## SEO

Title/H1: Geometric Mean Calculator
Meta description: Geometric Mean: geometric mean (same unit as the data). Calculate locally with explicit inputs and assumptions.
Canonical: https://alltoolnexa.pages.dev/tools/geometric-mean-calculator
H2: How to use; Common questions; Related tools.
Formula, explanation and reproducible worked example are rendered from registry data. Existing WebApplication, BreadcrumbList and FAQPage structured data are retained.
FAQs: What units should I enter? What assumptions apply? Answers use the field units and model explanation above.
Related: harmonic-mean-calculator, average-calculator.

## Five independent expected-result cases

1. Input: `{"text":"1 4 16"}` → expected: `4`.
2. Input: `{"text":"2 8"}` → expected: `4`.
3. Input: `{"text":"5 5 5"}` → expected: `5`.
4. Input: `{"text":".25 1"}` → expected: `0.5`.
5. Input: `{"text":"1e100 1e100"}` → expected: `1e+100`.

In addition, the automated suite checks missing/invalid numeric fields, nonfinite values, bounds, invalid lists and model-specific undefined cases. Relative answer tolerance is 1e-10 with an absolute floor of 1e-12.
