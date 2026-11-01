# AllToolNexa calculator competitor audit

**Status: INCOMPLETE / BLOCKED_NETWORK. This report deliberately does not assert a complete census or an exact missing-tool total.**

## Verified work and boundaries

- Inspected the actual Next.js repository, all 507 tool registrations, aliases, fields, mathematical methods and source anchors.
- Identified 248 primary numerical/calendar calculators or numeric converters under the explicit classification policy. Executed all 248 default examples successfully.
- Preserved two embedded calculation workspaces separately. A general spreadsheet or code editor is not an equivalent implementation of every imaginable calculator.
- Reviewed all 143 user candidates against implementations rather than treating candidate names as confirmed missing tools.
- Extracted 70 distinct official calculator-link destinations from four existing repository snapshots; no competitor source code, design or explanatory prose was imported into the application.
- Current robots, sitemaps, category pagination, terms and public tool pages could not be accessed because the cloud proxy denied the required hosts. No crawl followed the denied robots requests.
- The onboarding configuration draft is unavailable; no network change was saved or applied.

## Provenance

| Website / scope | Retained file | Capture state | Current verification |
| --- | --- | --- | --- |
| Calculator.net / homepage | [research/competitors/evidence/02.json](../research/competitors/evidence/02.json) | complete | UNVERIFIED; live access blocked |
| Calculator.net / calculator | [research/competitors/tool-evidence/02.json](../research/competitors/tool-evidence/02.json) | incomplete | UNVERIFIED; live access blocked |
| Omni / homepage | [research/competitors/evidence/12.json](../research/competitors/evidence/12.json) | incomplete | UNVERIFIED; live access blocked |
| Omni / calculator | [research/competitors/tool-evidence/12.json](../research/competitors/tool-evidence/12.json) | partial_tooling_error | UNVERIFIED; live access blocked |

SHA-256 hashes, evidence identifiers when issued, observed controls and limitations are retained in [evidence-index.json](calculator-audit-data/evidence-index.json). A partial browser-provider response is not a completed runtime test. Historical dates are not fresh verification dates.

## Historical interface findings

### Mortgage Calculator

Observed source: https://www.calculator.net/mortgage-calculator.html

Historical finding: The core financed-payment calculation and schedule exist. Integrated ownership expenses and recurring extra-payment combinations are not exposed in these tools. Extend existing loan tools rather than add another basic EMI implementation.

Existing canonical tools: `emi-calculator`, `loan-repayment-schedule`, `prepayment-calculator`, `down-payment-calculator`.

Current final comparison: **UNVERIFIED**. The retained interface supports a partial-overlap finding, but current full competitor behavior is not certified.

### Percentage Calculator

Observed source: https://www.omnicalculator.com/math/percentage

Historical finding: Percentage-of and related ratio/change operations exist on separate pages. The percentage page itself does not expose all four observed modes. Prefer extending it and retaining existing canonical slugs.

Existing canonical tools: `percentage-calculator`, `percentage-change`, `probability-calculator`, `ratio-calculator`.

Current final comparison: **UNVERIFIED**. The retained interface supports a partial-overlap finding, but current full competitor behavior is not certified.

## Duplicate policy

Canonicalize exact observed names and a very small documented synonym set only for discovery. Keep both source references. Never promote name grouping to functional equivalence without comparing formula, inputs, outputs, units and assumptions. Existing aliases resolve to canonical routes and must not get new pages.

Notable traps checked: EMI already includes reducing-balance payment totals; the loan schedule already amortizes monthly; HCF/GCD and LCM aliases exist; binary/hex conversion is not arithmetic; population variance is not a t-test; a random coin flip is not a binomial probability calculator; word frequency is not wave frequency; recipe scaling already covers the stated ingredient-scaling purpose.

## Candidate-by-candidate source-code review

The “project coverage” column concerns only the user-provided purpose, with limitations documented in JSON/CSV. The final comparison remains UNVERIFIED. A blank source reference means no actual official URL was observed for that candidate; none has been invented.

| # | Candidate | Project coverage | Existing implementation(s) | Observed official link | Final comparison |
| ---: | --- | --- | --- | --- | --- |
| 1 | Mortgage Calculator | PARTIAL MATCH | emi-calculator, loan-repayment-schedule, prepayment-calculator, down-payment-calculator | https://www.calculator.net/mortgage-calculator.html | UNVERIFIED |
| 2 | Mortgage Payoff Calculator | PARTIAL MATCH | prepayment-calculator, loan-tenure-calculator | https://www.calculator.net/mortgage-payoff-calculator.html | UNVERIFIED |
| 3 | House Affordability Calculator | PARTIAL MATCH | debt-to-income-calculator, loan-amount-calculator, down-payment-calculator | https://www.calculator.net/house-affordability-calculator.html | UNVERIFIED |
| 4 | Rent vs Buy Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 5 | APR Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 6 | Auto Loan Calculator | FUNCTIONAL EQUIVALENT | emi-calculator, loan-repayment-schedule | https://www.calculator.net/auto-loan-calculator.html | UNVERIFIED |
| 7 | Auto Lease Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 8 | Credit Card Payoff Calculator | PARTIAL MATCH | loan-tenure-calculator, prepayment-calculator | — | UNVERIFIED |
| 9 | Debt Payoff Calculator | PARTIAL MATCH | loan-tenure-calculator, prepayment-calculator | — | UNVERIFIED |
| 10 | Debt Consolidation Calculator | PARTIAL MATCH | emi-calculator, loan-tenure-calculator | — | UNVERIFIED |
| 11 | Student Loan Calculator | FUNCTIONAL EQUIVALENT | emi-calculator, loan-repayment-schedule | — | UNVERIFIED |
| 12 | College Cost Calculator | PARTIAL MATCH | inflation-calculator, future-value-calculator, savings-calculator | — | UNVERIFIED |
| 13 | Budget Calculator | PARTIAL MATCH | trip-budget-calculator | — | UNVERIFIED |
| 14 | Retirement Calculator | PARTIAL MATCH | savings-calculator, sip-mathematical-calculator, future-value-calculator, inflation-calculator | https://www.calculator.net/retirement-calculator.html | UNVERIFIED |
| 15 | Pension Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 16 | Annuity Calculator | PARTIAL MATCH | sip-mathematical-calculator, savings-calculator | — | UNVERIFIED |
| 17 | Annuity Payout Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 18 | Bond Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 19 | Certificate of Deposit Calculator | FUNCTIONAL EQUIVALENT | compound-interest-calculator, savings-calculator | — | UNVERIFIED |
| 20 | Mutual Fund Calculator | FUNCTIONAL EQUIVALENT | sip-mathematical-calculator, future-value-calculator | — | UNVERIFIED |
| 21 | Depreciation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 22 | Business Loan Calculator | FUNCTIONAL EQUIVALENT | emi-calculator, loan-repayment-schedule | — | UNVERIFIED |
| 23 | IRR Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 24 | Payback Period Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 25 | Rental Property Calculator | PARTIAL MATCH | roi-calculator | — | UNVERIFIED |
| 26 | Refinance Calculator | PARTIAL MATCH | emi-calculator, prepayment-calculator | — | UNVERIFIED |
| 27 | Home Equity Loan Calculator | FUNCTIONAL EQUIVALENT | emi-calculator, loan-repayment-schedule | — | UNVERIFIED |
| 28 | HELOC Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 29 | Loan Comparison Calculator | PARTIAL MATCH | emi-calculator, loan-repayment-schedule | — | UNVERIFIED |
| 30 | Debt Snowball Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 31 | Matrix Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 32 | Binary Calculator | PARTIAL MATCH | binary-to-decimal, decimal-to-binary | — | UNVERIFIED |
| 33 | Hex Calculator | PARTIAL MATCH | hex-to-decimal, decimal-to-hex | — | UNVERIFIED |
| 34 | Logarithm Calculator | PARTIAL MATCH | scientific-calculator | https://www.omnicalculator.com/math/log | UNVERIFIED |
| 35 | Half-Life Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 36 | Sample Size Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 37 | Z-Score Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 38 | Confidence Interval Calculator | NO EQUIVALENT FOUND | — | https://www.omnicalculator.com/statistics/confidence-interval | UNVERIFIED |
| 39 | P-Value Calculator | NO EQUIVALENT FOUND | — | https://www.omnicalculator.com/statistics/p-value | UNVERIFIED |
| 40 | Long Division Calculator | PARTIAL MATCH | basic-calculator | — | UNVERIFIED |
| 41 | Rounding Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 42 | Surface Area Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 43 | Right Triangle Calculator | PARTIAL MATCH | pythagorean-calculator, triangle-area, triangle-perimeter | — | UNVERIFIED |
| 44 | Distance Calculator | PARTIAL MATCH | slope-calculator, pythagorean-calculator | — | UNVERIFIED |
| 45 | Cubic Equation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 46 | System of Equations Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 47 | Polynomial Division Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 48 | Synthetic Division Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 49 | Complex Number Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 50 | Interval Notation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 51 | Significant Figures Calculator | NO EQUIVALENT FOUND | — | https://www.omnicalculator.com/math/sig-fig | UNVERIFIED |
| 52 | Geometric Mean Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 53 | Harmonic Mean Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 54 | Exponential Growth Calculator | PARTIAL MATCH | compound-interest-calculator, future-value-calculator, cagr-calculator | — | UNVERIFIED |
| 55 | Scientific Notation Calculator | NO EQUIVALENT FOUND | — | https://www.omnicalculator.com/math/scientific-notation | UNVERIFIED |
| 56 | Inverse Modulo Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 57 | Digital Root Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 58 | Truth Table Generator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 59 | ANOVA Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 60 | Bayes Theorem Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 61 | Conditional Probability Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 62 | Joint Probability Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 63 | Expected Value Calculator | PARTIAL MATCH | weighted-marks-calculator | — | UNVERIFIED |
| 64 | Confusion Matrix Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 65 | Coin Flip Probability Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 66 | Linear Regression Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 67 | Correlation Coefficient Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 68 | Chi-Square Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 69 | Hypothesis Testing Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 70 | T-Test Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 71 | Z-Test Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 72 | Covariance Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 73 | Frequency Distribution Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 74 | Binomial Distribution Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 75 | Normal Distribution Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 76 | Margin of Error Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 77 | Ohm's Law Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 78 | Voltage Drop Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 79 | Resistor Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 80 | BTU Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 81 | Horsepower Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 82 | Kinetic Energy Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 83 | Potential Energy Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 84 | Force Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 85 | Pressure Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 86 | Density Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 87 | Acceleration Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 88 | Momentum Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 89 | Projectile Motion Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 90 | Wavelength Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 91 | Frequency Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 92 | Torque Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 93 | Electrical Power Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 94 | Electrical Energy Calculator | FUNCTIONAL EQUIVALENT | watt-to-unit-calculator, appliance-electricity-cost, ev-charging-cost | — | UNVERIFIED |
| 95 | Transformer Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 96 | Coulomb's Law Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 97 | Brick Calculator | PARTIAL MATCH | tile-calculator, concrete-volume-calculator | — | UNVERIFIED |
| 98 | Drywall Calculator | PARTIAL MATCH | tile-calculator | — | UNVERIFIED |
| 99 | Rebar Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 100 | Lumber Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 101 | Decking Calculator | PARTIAL MATCH | tile-calculator, flooring-cost | — | UNVERIFIED |
| 102 | Metal Weight Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 103 | Pipe Weight Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 104 | Framing Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 105 | Retaining Wall Calculator | PARTIAL MATCH | tile-calculator, concrete-volume-calculator | — | UNVERIFIED |
| 106 | Sand Calculator | PARTIAL MATCH | concrete-volume-calculator | — | UNVERIFIED |
| 107 | Board Foot Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 108 | Stair Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 109 | Roofing Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 110 | Gravel Calculator | PARTIAL MATCH | concrete-volume-calculator | — | UNVERIFIED |
| 111 | Mulch Calculator | PARTIAL MATCH | concrete-volume-calculator | — | UNVERIFIED |
| 112 | Molar Mass Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 113 | Molarity Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 114 | Atomic Mass Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 115 | Grams to Moles Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 116 | Mole Fraction Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 117 | Empirical Formula Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 118 | Percent Composition Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 119 | Buffer pH Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 120 | Electron Configuration Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 121 | Business Valuation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 122 | Cost of Goods Sold Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 123 | Contribution Margin Calculator | PARTIAL MATCH | margin-calculator, profit-calculator | — | UNVERIFIED |
| 124 | Customer Retention Rate Calculator | PARTIAL MATCH | churn-rate | — | UNVERIFIED |
| 125 | Accounts Receivable Days Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 126 | FIFO Inventory Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 127 | Google AdSense Revenue Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 128 | YouTube Revenue Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 129 | Full-Time Equivalent Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 130 | Safety Stock Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 131 | Profitability Index Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 132 | Pre-Money Valuation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 133 | Post-Money Valuation Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 134 | Air Fryer Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 135 | Cake Pan Converter | PARTIAL MATCH | recipe-scaling-calculator, circle-area, rectangle-area | — | UNVERIFIED |
| 136 | Cooking Measurement Converter | PARTIAL MATCH | cup-to-ml, tablespoon-to-ml, teaspoon-to-ml, gram-to-kg, ounce-to-gram | — | UNVERIFIED |
| 137 | Pizza Comparison Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 138 | Recipe Cost Calculator | PARTIAL MATCH | cost-per-serving-calculator, food-cost-percentage-calculator | — | UNVERIFIED |
| 139 | Ingredient Quantity Calculator | FUNCTIONAL EQUIVALENT | recipe-scaling-calculator | — | UNVERIFIED |
| 140 | Flight Carbon Footprint Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 141 | Household Carbon Footprint Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 142 | AI Water Footprint Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |
| 143 | Electricity Carbon Footprint Calculator | NO EQUIVALENT FOUND | — | — | UNVERIFIED |

## Missing-only deliverables

[all-missing-calculators.csv](all-missing-calculators.csv) and [all-missing-calculators.json](all-missing-calculators.json) contain no confirmed rows. The full missing total is unknown, not zero. Detailed project-coverage notes are in [calculator-candidate-comparison.json](calculator-candidate-comparison.json).

## Required access to continue

Allow these hostnames in the cloud environment network settings while preserving existing allowed destinations: `calculator.net`, `www.calculator.net`, `omnicalculator.com`, `www.omnicalculator.com`, `alltoolnexa.pages.dev`.

After a supported configuration update, retry robots.txt once, review terms and crawl directives, then fetch official sitemaps/category listings with per-host rate limiting. Respect a larger advertised crawl delay, cache responses, follow only allowed public links, stop on challenge/access-denied/rate-limit responses, and mark unavailable pages UNVERIFIED. Do not guess endpoints or bypass restrictions.

Only after a current inventory, six-state comparison and per-tool specifications are established should the first 20 confirmed missing calculators be selected. Preserve the five main categories and use existing subcategories; extend partial matches instead of cloning them.
