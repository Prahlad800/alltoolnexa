# Linear Regression Calculator

Slug: `linear-regression-calculator`
Main category: Calculators & Utilities
Subcategory: Math & Numbers
Priority: User-authorized initial batch
Purpose/output: Slope and intercept (units follow the input data).
Competitor references: UNVERIFIED. This original implementation is not represented as a confirmed competitor gap.

## Required inputs

Units are explicit in the labels. No optional inputs or currency.

| Key | Label and unit | Type | Minimum | Maximum | Default | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| x | X observations | textarea | 2 observations | 1,000 observations | 1, 2, 3 | Required finite numeric list, 2–1,000 values; magnitude ≤ 1e100. |
| y | Y observations | textarea | 2 observations | 1,000 observations | 2, 4, 6 | Required finite numeric list, 2–1,000 values; magnitude ≤ 1e100. |

## Mathematical logic and calculation steps

Ordinary least squares: slope b = Σ(dx·dy)/Σ(dx²); intercept a = ȳ−b·x̄; fitted y = a+b·x.

1. Parse each required input and enforce finite values, field bounds and model-domain checks.
2. Apply the formula above in browser JavaScript; no API request.
3. Reject nonfinite results and round presentation to 12 significant digits. Keep units in the result context.

Fit one explanatory variable with an intercept by unweighted least squares. The result is a line description, not a causal model or a forecast guarantee. A constant Y series is allowed.

## Outputs

Slope and intercept (units follow the input data). Regression returns slope, intercept and observation count; all other tools return a scalar.

## UI and mobile layout

Use the shared labelled form, Calculate and Reset/Clear controls and result card. On desktop keep form and results together; stack on mobile with no horizontal overflow. Below the calculator show the formula, model explanation, default-input worked example, original FAQs and related tools.

## Validation and numeric limits

Reject blank, NaN, infinity and values outside field bounds. Reject zero denominators, nonpositive inputs where the formula requires positivity, unsupported selector values and mismatched paired series. Dataset values are bounded at magnitude 1e100 and lists at 1,000 observations. Turns require safe positive integers. Negative values are accepted only where meaningful (signed velocity/acceleration/height, observed data and means). Very small nonzero denominators that overflow are rejected. JavaScript floating-point arithmetic is approximate; do not claim exact decimal arithmetic. Geometric mean uses logs, harmonic mean uses minimum-value scaling, and correlation normalizes without multiplying variances.

## SEO

Title/H1: Linear Regression Calculator
Meta description: Linear Regression: slope and intercept (units follow the input data). Calculate locally with explicit inputs and assumptions.
Canonical: https://alltoolnexa.pages.dev/tools/linear-regression-calculator
H2: How to use; Common questions; Related tools.
Formula, explanation and reproducible worked example are rendered from registry data. Existing WebApplication, BreadcrumbList and FAQPage structured data are retained.
FAQs: What units should I enter? What assumptions apply? Answers use the field units and model explanation above.
Related: correlation-coefficient-calculator, covariance-calculator.

## Five independent expected-result cases

1. Input: `{"x":"1 2 3","y":"2 4 6"}` → expected: `{"slope":2,"intercept":0,"observations":3}`.
2. Input: `{"x":"0 1","y":"3 5"}` → expected: `{"slope":2,"intercept":3,"observations":2}`.
3. Input: `{"x":"1 2","y":"5 3"}` → expected: `{"slope":-2,"intercept":7,"observations":2}`.
4. Input: `{"x":"1 2 3","y":"5 5 5"}` → expected: `{"slope":0,"intercept":5,"observations":3}`.
5. Input: `{"x":"-1 0 1","y":"1 0 1"}` → expected: `{"slope":0,"intercept":0.6666666666666666,"observations":3}`.

In addition, the automated suite checks missing/invalid numeric fields, nonfinite values, bounds, invalid lists and model-specific undefined cases. Relative answer tolerance is 1e-10 with an absolute floor of 1e-12.
