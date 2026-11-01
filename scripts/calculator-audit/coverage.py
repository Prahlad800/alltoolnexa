"""Analyst-reviewed project coverage of the user's 143 candidate purposes.

This is NOT a claim that a candidate is a verified competitor product or that
its full UI matches. Final competitor classifications remain evidence-gated.
"""

# Candidate number: existing registrations, project coverage, and scope limits.
COVERAGE = {
 1: ('emi-calculator loan-repayment-schedule prepayment-calculator down-payment-calculator', 'PARTIAL MATCH', 'Fixed-rate principal/interest and amortization already exist. An integrated mortgage form would still need taxes, insurance, recurring costs and multiple extra-payment schedules.'),
 2: ('prepayment-calculator loan-tenure-calculator', 'PARTIAL MATCH', 'One lump-sum prepayment after an installment is implemented; recurring and mixed extra-payment schedules are not.'),
 3: ('debt-to-income-calculator loan-amount-calculator down-payment-calculator', 'PARTIAL MATCH', 'Debt ratio, affordable principal and down payment are separate calculations. No integrated home-budget model with ownership costs is registered.'),
 6: ('emi-calculator loan-repayment-schedule', 'FUNCTIONAL EQUIVALENT', 'The candidate basic fixed-rate vehicle-loan payment calculation is already the EMI/amortization formula. Vehicle taxes, trade-ins and fee rules need competitor verification.'),
 8: ('loan-tenure-calculator prepayment-calculator', 'PARTIAL MATCH', 'A fixed-payment single-balance payoff exists; revolving minimum-payment rules, fees and changing rates do not.'),
 9: ('loan-tenure-calculator prepayment-calculator', 'PARTIAL MATCH', 'Single-loan duration and one lump sum exist, without multi-debt allocation.'),
 10: ('emi-calculator loan-tenure-calculator', 'PARTIAL MATCH', 'A proposed combined balance can be calculated, but there is no debt aggregation or before/after consolidation comparison.'),
 11: ('emi-calculator loan-repayment-schedule', 'FUNCTIONAL EQUIVALENT', 'The basic education-loan installment calculation is already covered. Grace periods, subsidies and jurisdictional rules are unverified.'),
 12: ('inflation-calculator future-value-calculator savings-calculator', 'PARTIAL MATCH', 'Cost escalation and saving growth exist independently; a year-by-year education funding plan does not.'),
 13: ('trip-budget-calculator', 'PARTIAL MATCH', 'A travel-specific expense total exists. It is not a general household income/expense budget.'),
 14: ('savings-calculator sip-mathematical-calculator future-value-calculator inflation-calculator', 'PARTIAL MATCH', 'Accumulation and inflation are available. Retirement spending, withdrawals and decumulation are not integrated.'),
 16: ('sip-mathematical-calculator savings-calculator', 'PARTIAL MATCH', 'Ordinary end-of-month annuity future value is implemented. Arbitrary payment frequency, annuity-due timing and payout modes are not.'),
 19: ('compound-interest-calculator savings-calculator', 'FUNCTIONAL EQUIVALENT', 'Fixed principal/deposit growth at an assumed rate is implemented. Competitor-specific compounding, tax and withdrawal modes remain unverified.'),
 20: ('sip-mathematical-calculator future-value-calculator', 'FUNCTIONAL EQUIVALENT', 'The stated basic assumed investment-growth scenarios already exist; no market-return prediction or fund-performance feed is present.'),
 22: ('emi-calculator loan-repayment-schedule', 'FUNCTIONAL EQUIVALENT', 'Ordinary fixed-rate business-loan payments use the existing loan formula. Fees, variable rates and balloon payments are separate scope.'),
 25: ('roi-calculator', 'PARTIAL MATCH', 'A simple investment-return percentage exists, without rent, vacancy, operating expenses, financing and property cash-flow inputs.'),
 26: ('emi-calculator prepayment-calculator', 'PARTIAL MATCH', 'Payments and a lump sum can be explored separately; refinancing closing-cost and break-even comparison is not integrated.'),
 27: ('emi-calculator loan-repayment-schedule', 'FUNCTIONAL EQUIVALENT', 'A fully amortizing fixed-rate home-equity payment has the same existing inputs/formula. Equity limits and lender criteria are not calculated.'),
 29: ('emi-calculator loan-repayment-schedule', 'PARTIAL MATCH', 'A single loan can be evaluated; there is no simultaneous multi-offer comparison result.'),
 32: ('binary-to-decimal decimal-to-binary', 'PARTIAL MATCH', 'Base-2 representation conversion exists. Two-operand binary arithmetic does not.'),
 33: ('hex-to-decimal decimal-to-hex', 'PARTIAL MATCH', 'Base-16 representation conversion exists. Two-operand hexadecimal arithmetic does not.'),
 34: ('scientific-calculator', 'PARTIAL MATCH', 'Natural log and base-10 log exist; arbitrary-base logarithms are not an exposed mode.'),
 40: ('basic-calculator', 'PARTIAL MATCH', 'A division result exists, without a long-division step sequence or repeating-decimal explanation.'),
 43: ('pythagorean-calculator triangle-area triangle-perimeter', 'PARTIAL MATCH', 'Hypotenuse from two legs, area from base/height and perimeter from three sides exist. A unified solver for missing legs and angles is not exposed.'),
 44: ('slope-calculator pythagorean-calculator', 'PARTIAL MATCH', 'Coordinate input and two-leg length calculations exist separately. The coordinate form does not output Euclidean distance; extend it rather than clone its form.'),
 54: ('compound-interest-calculator future-value-calculator cagr-calculator', 'PARTIAL MATCH', 'Discrete exponential growth is already used in finance; a unit-neutral continuous-growth/decay solver is not exposed.'),
 63: ('weighted-marks-calculator', 'PARTIAL MATCH', 'Weighted-average arithmetic exists. An expected-value mode would need explicitly validated probabilities and outcome labels.'),
 94: ('watt-to-unit-calculator appliance-electricity-cost ev-charging-cost', 'FUNCTIONAL EQUIVALENT', 'The stated watts × hours / 1000 electricity-consumption calculation already exists, along with optional energy cost.'),
 97: ('tile-calculator concrete-volume-calculator', 'PARTIAL MATCH', 'Coverage-area material count and rectangular volume exist. Brick dimensions, bond, mortar and wall openings are not modeled.'),
 98: ('tile-calculator', 'PARTIAL MATCH', 'Sheet-like coverage count with waste has the same basic area calculation. Openings, multiple walls and drywall-specific sizes need verification.'),
 101: ('tile-calculator flooring-cost', 'PARTIAL MATCH', 'Coverage quantity and cost exist; board width, gaps, layout and framing are not modeled.'),
 105: ('tile-calculator concrete-volume-calculator', 'PARTIAL MATCH', 'Area count and volume are useful existing components, without a retaining-wall materials workflow. No structural stability claim is justified.'),
 106: ('concrete-volume-calculator', 'PARTIAL MATCH', 'Rectangular material volume exists; bulk density, moisture and mass estimation are not included.'),
 110: ('concrete-volume-calculator', 'PARTIAL MATCH', 'Rectangular volume exists; gravel-specific mass and bulk-density assumptions are absent.'),
 111: ('concrete-volume-calculator', 'PARTIAL MATCH', 'Area-depth volume can be obtained from dimensions. Bag sizes and bulk mulch units are not exposed.'),
 123: ('margin-calculator profit-calculator', 'PARTIAL MATCH', 'Amount difference and margin ratio are implemented. Contribution-specific variable/fixed cost separation and per-unit totals need an explicit mode.'),
 124: ('churn-rate', 'PARTIAL MATCH', 'Customer loss rate exists. Retention can be its complement for the same cohort, but a start/end/new-customer reconciliation form is not exposed.'),
 135: ('recipe-scaling-calculator circle-area rectangle-area', 'PARTIAL MATCH', 'Ingredient scaling and shape areas exist separately. Add a pan-area/thickness scaling mode to the existing workflow after verification.'),
 136: ('cup-to-ml tablespoon-to-ml teaspoon-to-ml gram-to-kg ounce-to-gram', 'PARTIAL MATCH', 'Several cooking volume/mass conversions exist. Cup standards, additional units and ingredient-dependent density require explicit verified assumptions.'),
 138: ('cost-per-serving-calculator food-cost-percentage-calculator', 'PARTIAL MATCH', 'Serving cost and food-cost ratio exist, without ingredient purchase-unit/yield costing.'),
 139: ('recipe-scaling-calculator', 'FUNCTIONAL EQUIVALENT', 'The complete candidate basic scaling calculation quantity × desired servings / original servings is already implemented.'),
}

CLUSTERS = {
 6: 'fixed-rate-loan-payment', 11: 'fixed-rate-loan-payment', 22: 'fixed-rate-loan-payment', 27: 'fixed-rate-loan-payment',
 47: 'polynomial-division-with-synthetic-mode', 48: 'polynomial-division-with-synthetic-mode',
 127: 'manual-rpm-ad-revenue-estimate', 128: 'manual-rpm-ad-revenue-estimate',
 132: 'investment-pre-post-money-valuation', 133: 'investment-pre-post-money-valuation',
}


def coverage_for(number):
    ids, status, note = COVERAGE.get(number, ('', 'NO EQUIVALENT FOUND', 'No dedicated input/output workflow for the candidate purpose was found in the reviewed registry, aliases, registrations or spreadsheet supported-function list. Generic arithmetic is not treated as an equivalent calculator. This is not a verified competitor missing-tool classification.'))
    return {'existingToolIds': ids.split(), 'projectCoverageStatus': status, 'projectCoverageReason': note}
