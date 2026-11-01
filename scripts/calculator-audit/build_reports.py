"""Generate a bounded, provenance-preserving audit. Never infer a missing census.

Run export-existing.mjs first. No network requests are made by this command.
"""
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from coverage import CLUSTERS, coverage_for
from evidence import ROOT, read_all, observed_listing

REPORTS = ROOT / 'reports'
DATA = REPORTS / 'calculator-audit-data'
STATUSES = ['EXACT MATCH', 'FUNCTIONAL EQUIVALENT', 'PARTIAL MATCH', 'MISSING', 'NOT APPLICABLE', 'UNVERIFIED']
MISSING_FIELDS = ['Tool ID', 'Tool Name', 'Competitor Website', 'Competitor URL', 'Existing AllToolNexa Equivalent', 'Comparison Status', 'Main Category', 'Subcategory', 'Priority', 'Purpose', 'Input Fields', 'Output Fields', 'Formulas', 'Suggested Slug', 'Recommended Features', 'Technical Complexity', 'Implementation Status']
NETWORK = {
    'state': 'blocked', 'policy': 'restricted; enforced',
    'probes': [{'url': f'https://{host}/robots.txt', 'result': 'Tunnel connection failed: 403 Forbidden'} for host in ['www.calculator.net', 'www.omnicalculator.com', 'alltoolnexa.pages.dev']],
    'robotsRulesVerified': False, 'liveCrawlPerformed': False,
    'configurationDraftSaved': False,
    'draftFailure': 'INVALID_ARGUMENT: onboarding draft or configuration unavailable',
    'requiredAllowedDomains': ['calculator.net', 'www.calculator.net', 'omnicalculator.com', 'www.omnicalculator.com', 'alltoolnexa.pages.dev'],
    'restrictionRespected': 'No proxy bypass, mirrors, alternate routes or further competitor crawl after robots access was denied.',
}


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_csv(path, rows, fields):
    with path.open('w', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fields, extrasaction='ignore', lineterminator='\n')
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(row.get(key), ensure_ascii=False) if isinstance(row.get(key), (dict, list)) else row.get(key) for key in fields})


def normalize(name):
    text = re.sub(r'[^a-z0-9]+', ' ', name.lower()).strip()
    text = re.sub(r'\b(calculator|calculators|generator)\b', '', text)
    text = ' '.join(text.split())
    return {'log logarithm': 'logarithm', 'significant figures sig fig': 'significant figures', 'p value': 'p value'}.get(text, text)


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def safe(text):
    return str(text or '—').replace('|', '/').replace('\n', ' ')


def get_profiles():
    return {
        'https://www.calculator.net/mortgage-calculator.html': {
            'description': 'Explore a financed house purchase with ownership expenses and additional payments.',
            'purpose': 'Monthly mortgage cost and repayment schedule.',
            'inputFields': {'observedCoreControls': ['house price', 'down payment and amount/percentage selector', 'loan term in years', 'annual interest rate', 'start month/year'], 'observedOptionalControls': ['property tax', 'home insurance', 'mortgage insurance', 'association fees', 'other costs', 'expense growth assumptions', 'monthly/annual/one-time extra payments']},
            'outputFields': ['monthly principal/interest payment', 'ownership-cost components', 'amortization schedule'],
            'formula': None,
            'formulaVerification': 'The full competitor calculation model was not verified. Existing P&I is independently verified in the project: M=P*r/(1-(1+r)^(-n)); M=P/n at zero rate.',
            'units': ['years', 'months', '%', 'money amounts'],
            'supportedCurrency': None, 'observedCurrency': '$; US mortgage context; no currency switch verified',
            'complexity': 'Intermediate', 'indiaRelevance': 'Medium',
            'historicalComparisonStatus': 'PARTIAL MATCH',
            'existingToolIds': ['emi-calculator', 'loan-repayment-schedule', 'prepayment-calculator', 'down-payment-calculator'],
            'historicalFinding': 'The core financed-payment calculation and schedule exist. Integrated ownership expenses and recurring extra-payment combinations are not exposed in these tools. Extend existing loan tools rather than add another basic EMI implementation.',
        },
        'https://www.omnicalculator.com/math/percentage': {
            'description': 'Solve a percentage amount, a part-to-total rate, an inverse base, or an adjusted amount.',
            'purpose': 'Four percentage calculation modes visible in retained controls and mathematical notation.',
            'inputFields': {'observedModes': ['rate and base amount', 'part and total', 'part and percentage rate', 'starting amount, percentage and increase/decrease selector']},
            'outputFields': ['percentage amount', 'percentage rate', 'inferred total', 'increased/decreased amount'],
            'formula': ['amount = base * rate / 100', 'rate = part / total * 100', 'base = part * 100 / rate', 'adjusted = start * (1 + rate/100) or start * (1 - rate/100)'],
            'formulaVerification': 'Arithmetic relationships are visible in the retained rendered mathematical notation; runtime validation and current page behavior are unverified.',
            'units': ['%', 'unitless numbers'], 'supportedCurrency': 'not applicable',
            'complexity': 'Basic', 'indiaRelevance': 'High',
            'historicalComparisonStatus': 'PARTIAL MATCH',
            'existingToolIds': ['percentage-calculator', 'percentage-change', 'probability-calculator', 'ratio-calculator'],
            'historicalFinding': 'Percentage-of and related ratio/change operations exist on separate pages. The percentage page itself does not expose all four observed modes. Prefer extending it and retaining existing canonical slugs.',
        },
    }


def build():
    DATA.mkdir(parents=True, exist_ok=True)
    inventory = json.loads((DATA / 'existing-tool-inventory.json').read_text())
    existing = {row['id']: row for row in inventory['records']}
    snapshots = read_all()
    source_by_url, category_links = {}, defaultdict(dict)
    for facts, page in snapshots:
        rows, categories = observed_listing(facts, page)
        for category in categories:
            category_links[facts['website']][category['url']] = category['name']
        for row in rows:
            entry = source_by_url.setdefault(row['sourceUrl'], {**row, 'nameObservations': [], 'evidenceFiles': []})
            entry['nameObservations'].append(row['toolName'])
            if row['evidenceFile'] not in entry['evidenceFiles']:
                entry['evidenceFiles'].append(row['evidenceFile'])
            if not entry.get('category'):
                entry['category'] = row['category']
        if facts['scope'] == 'calculator':
            entry = source_by_url.setdefault(facts['url'], {'sourceUrl': facts['url'], 'sourceWebsite': facts['website'], 'nameObservations': [], 'evidenceFiles': [], 'category': 'Financial Calculators' if facts['website'] == 'Calculator.net' else 'Mathematics'})
            entry['nameObservations'].append(facts['title'])
            entry['pageObservation'] = facts
    profiles = get_profiles()
    for url, entry in source_by_url.items():
        names = entry.pop('nameObservations')
        title = entry.get('pageObservation', {}).get('title')
        entry['toolName'] = title or sorted(names, key=lambda value: (0 if 'calculator' in value.lower() or 'generator' in value.lower() else 1, len(value)))[0]
        entry['auditStatus'] = 'Unverified'
        entry['comparisonStatus'] = 'UNVERIFIED'
        entry['livePageVerified'] = False
        entry['description'] = None
        entry['inputFields'] = None
        entry['outputFields'] = None
        entry['formula'] = None
        entry['units'] = None
        entry['complexity'] = None
        entry['indiaRelevance'] = None
        if url in profiles:
            entry.update(profiles[url])
        entry['sourceVerificationScope'] = 'Historical retained interface; incomplete capture and no runtime calculation test.' if 'pageObservation' in entry else 'Historical official-page hyperlink only; destination interface, inputs, formulas and behavior are unverified.'
        entry['clinicalReviewRequired'] = entry.get('category') in ['Fitness & Health Calculators', 'Health']
    sources = sorted(source_by_url.values(), key=lambda entry: (entry['sourceWebsite'], entry['sourceUrl']))
    for index, source in enumerate(sources, 1):
        source['id'] = f'SRC-{index:04d}'
    canonical = {}
    for source in sources:
        key = normalize(source['toolName'])
        if key not in canonical:
            canonical[key] = {'id': 'CALC-' + hashlib.sha256(key.encode()).hexdigest()[:12], 'toolName': source['toolName'], 'normalizedName': key, 'sources': [], 'auditStatus': 'Unverified', 'comparisonStatus': 'UNVERIFIED', 'implementationEligible': False, 'duplicateReview': 'Name grouping only; full formula/input/output equivalence remains unverified.'}
        canonical[key]['sources'].append(source)
    master = list(canonical.values())
    candidates = []
    for number, line in enumerate((Path(__file__).with_name('candidates.tsv')).read_text().splitlines(), 1):
        group, name, purpose = line.split('\t')
        coverage = coverage_for(number)
        for tool_id in coverage['existingToolIds']:
            if tool_id not in existing:
                raise ValueError(f'Unknown existing equivalent {tool_id} for candidate {number}')
        refs = [source for source in sources if normalize(source['toolName']) == normalize(name)]
        category = 'marketing' if group == 'Business & Marketing' else 'finance' if group == 'Finance & Banking' else 'home' if group in ['Construction', 'Food & Everyday', 'Ecology'] else 'math'
        if number == 129:
            category = 'office'
        parent = next(row for row in inventory['mainCategories'] if category in row['children'])
        candidates.append({'id': f'CAND-{number:03d}', 'number': number, 'toolName': name, 'candidateGroup': group, 'candidatePurpose': purpose, 'purposeSource': 'User-provided starting list; not a competitor claim.', **coverage, 'existingSourceLocations': [loc for tool_id in coverage['existingToolIds'] for loc in existing[tool_id]['sourceLocations']], 'existingMethods': [{'toolId': tool_id, 'method': existing[tool_id]['mathematicalMethod'], 'inputFields': existing[tool_id]['inputFields']} for tool_id in coverage['existingToolIds']], 'competitorReferences': [{'sourceWebsite': source['sourceWebsite'], 'sourceUrl': source['sourceUrl'], 'verification': source['sourceVerificationScope']} for source in refs], 'comparisonStatus': 'UNVERIFIED', 'auditStatus': 'Unverified', 'implementationEligible': False, 'implementationStatus': 'BLOCKED: competitor research/verification prerequisite', 'suggestedSlug': coverage['existingToolIds'][0] if coverage['existingToolIds'] else slugify(name), 'proposedMainCategory': parent['name'], 'proposedSubcategory': next(row['name'] for row in inventory['categories'] if row['id'] == category), 'priority': 'High' if group in ['Finance & Banking', 'Mathematics', 'Statistics', 'Construction', 'Business & Marketing'] else 'Medium', 'priorityScope': 'Candidate triage only; not the first-20 implementation ranking.', 'potentialDuplicateCluster': CLUSTERS.get(number), 'requiredNextEvidence': 'Verify official listing and calculator page; document inputs/outputs, units, assumptions, formula, validation and compare full functionality. A name or generic arithmetic is insufficient.'})
    added = [row['id'] for row in inventory['records'] if any(loc['file'] == 'frontend/shared/science-calculators.mjs' for loc in row['sourceLocations'])]
    for row in candidates:
        if any(tool_id in added for tool_id in row['existingToolIds']):
            row['implementationStatus'] = 'IMPLEMENTED: user-authorized original batch; competitor equivalence unverified'
    if len(candidates) != 143:
        raise ValueError('The input list must preserve all 143 user candidates.')
    counts = Counter(source['sourceWebsite'] for source in sources)
    coverage_counts = Counter(row['projectCoverageStatus'] for row in candidates)
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    summary = {'auditDateUTC': now, 'auditComplete': False, 'status': 'BLOCKED_NETWORK', 'codeRevision': inventory['codeRevision'], 'existingCounts': inventory['counts'], 'historicalSnapshotDate': '2026-10-24', 'historicalObservedLinkCounts': dict(counts), 'historicalCanonicalNameGroups': len(master), 'nameGroupsWithBothSources': sum(len({source['sourceWebsite'] for source in row['sources']}) > 1 for row in master), 'competitorTotalCalculators': {'Calculator.net': None, 'Omni': None}, 'confirmedMissingExportRows': 0, 'completeUniqueMissingTotal': None, 'missingTotalWarning': 'Zero confirmed export rows does not mean no missing calculators. The full census and missing total are NOT ESTABLISHED.', 'candidatesReviewedAgainstProject': len(candidates), 'candidateProjectCoverageCounts': dict(coverage_counts), 'candidateStatusesAreNotFinalCompetitorClassifications': True, 'implementationBatch': {'requestedSize': 20, 'selected': [], 'implemented': [], 'blockedReason': 'Neither a full current competitor census nor 20 confirmed missing tools/specifications is established. Honor the research-first implementation gate.'}, 'network': NETWORK}
    summary['userAuthorizedOriginalBatch'] = {'implemented': added, 'count': len(added), 'competitorVerification': 'UNVERIFIED', 'report': 'calculator-batch-one.md'}
    dump(DATA / 'evidence-index.json', {'auditDateUTC': now, 'network': NETWORK, 'snapshots': [facts for facts, _ in snapshots]})
    dump(DATA / 'summary.json', summary)
    dump(REPORTS / 'competitor-calculator-master.json', {'auditComplete': False, 'scope': 'Only links retained in four historical snapshots; NOT a full competitor inventory.', 'records': master})
    flat = [{key: source.get(key) for key in ['id', 'toolName', 'category', 'sourceWebsite', 'sourceUrl', 'description', 'inputFields', 'outputFields', 'formula', 'units', 'complexity', 'indiaRelevance', 'auditStatus', 'comparisonStatus', 'sourceVerificationScope', 'evidenceFiles']} for source in sources]
    write_csv(REPORTS / 'competitor-calculator-master.csv', flat, list(flat[0]))
    dump(REPORTS / 'calculator-candidate-comparison.json', {'auditComplete': False, 'records': candidates})
    write_csv(REPORTS / 'calculator-candidate-comparison.csv', candidates, ['id', 'toolName', 'candidateGroup', 'candidatePurpose', 'projectCoverageStatus', 'existingToolIds', 'projectCoverageReason', 'competitorReferences', 'comparisonStatus', 'auditStatus', 'suggestedSlug', 'proposedMainCategory', 'proposedSubcategory', 'priority', 'implementationStatus'])
    calculators = [row for row in inventory['records'] if row['classification'] == 'standalone_calculator']
    dump(REPORTS / 'existing-calculators.json', {'definition': 'Reviewed primary numerical/calendar calculators and numeric converters; other tools and embedded document/workbook calculations are retained separately in the complete source inventory.', 'counts': inventory['counts'], 'records': calculators})
    write_csv(REPORTS / 'existing-calculators.csv', calculators, ['id', 'name', 'path', 'categoryName', 'inputFields', 'mathematicalMethod', 'sourceLocations', 'aliases', 'defaultExecution'])
    dump(REPORTS / 'all-missing-calculators.json', {'auditComplete': False, 'confirmedMissingExportRows': 0, 'completeUniqueMissingTotal': None, 'warning': summary['missingTotalWarning'], 'implementationBlocked': True, 'records': []})
    write_csv(REPORTS / 'all-missing-calculators.csv', [], MISSING_FIELDS)
    net, omni = counts['Calculator.net'], counts['Omni']
    metrics = [
        '# Calculator comparison summary', '', '**INCOMPLETE — live source access is blocked. No full competitor census or missing total is established.**', '',
        f'Audit date: {now} UTC. Source-code revision: `{inventory["codeRevision"]}`. Retained competitor snapshots: 24 October 2026, with incomplete captures.', '',
        '| Metric | Calculator.net | Omni Calculator | AllToolNexa |', '| --- | --- | --- | --- |',
        f'| Total calculators, complete verified census | Not established | Not established | {inventory["counts"]["standaloneCalculators"]} standalone calculators in source |',
        f'| Historical distinct tool-link destinations observed | {net} | {omni} | {inventory["counts"]["registeredTools"]} registered tools; 2 embedded calculation workspaces |',
        f'| Category links observed / source categories | {len(category_links["Calculator.net"])} historical category links | {len(category_links["Omni"])} historical category links | 5 main / 18 subcategories |',
        '| Current verified exact matches | 0 established | 0 established | — |',
        '| Current verified functional equivalents | 0 established | 0 established | — |',
        '| Current verified partial matches | 0 established | 0 established | — |',
        '| Missing calculators | Not established | Not established | — |',
        '| Complete unique missing total | Not established | Not established | — |',
        f'| Unverified current source entries in this bounded inventory | {net} | {omni} | {inventory["counts"]["standaloneCalculators"]} public-page deployments not live-verified; {inventory["counts"]["defaultExecutionsPassed"]} source defaults executed |', '',
        f'There are {len(master)} provisional canonical name groups across {len(sources)} source URLs. {summary["nameGroupsWithBothSources"]} groups have both source websites. This is name grouping, not a claim of identical full functionality.', '',
        '## Candidate project coverage', '', 'These counts come from the 143 user candidates and reviewed project implementations, NOT from a completed competitor comparison.', '',
        '| Source-code coverage of the stated candidate purpose | Count |', '| --- | ---: |',
        *[f'| {status} | {coverage_counts[status]} |' for status in ['FUNCTIONAL EQUIVALENT', 'PARTIAL MATCH', 'NO EQUIVALENT FOUND']], '',
        'All 143 final competitor comparison statuses remain UNVERIFIED pending current source research. “No equivalent found” here must not be promoted to “confirmed missing competitor tool.”', '',
        'The missing-only CSV has headers and no confirmed rows; the JSON includes `auditComplete: false` and a null full missing total. Their empty record sets are NOT evidence that the project has no gaps.', '',
        'A later user instruction authorized adding 20 original calculators while live research remains blocked. That batch is implemented and documented in calculator-batch-one.md; it is not a verified competitor-gap batch. The full competitor audit remains incomplete.', '',
        'See [full audit](calculator-competitor-audit.md), [candidate comparison](calculator-candidate-comparison.csv), [existing calculators](existing-calculators.csv), [implementation readiness](calculator-implementation-readiness.md) and [architecture](calculator-project-architecture.md).',
    ]
    (REPORTS / 'calculator-comparison-summary.md').write_text('\n'.join(metrics) + '\n')
    detail = [
        '# AllToolNexa calculator competitor audit', '', '**Status: INCOMPLETE / BLOCKED_NETWORK. This report deliberately does not assert a complete census or an exact missing-tool total.**', '',
        '## Verified work and boundaries', '',
        f'- Inspected the actual Next.js repository, all {len(inventory["records"])} tool registrations, aliases, fields, mathematical methods and source anchors.',
        f'- Identified {len(calculators)} primary numerical/calendar calculators or numeric converters under the explicit classification policy. Executed all {len(calculators)} default examples successfully.',
        '- Preserved two embedded calculation workspaces separately. A general spreadsheet or code editor is not an equivalent implementation of every imaginable calculator.',
        '- Reviewed all 143 user candidates against implementations rather than treating candidate names as confirmed missing tools.',
        f'- Extracted {len(sources)} distinct official calculator-link destinations from four existing repository snapshots; no competitor source code, design or explanatory prose was imported into the application.',
        '- Current robots, sitemaps, category pagination, terms and public tool pages could not be accessed because the cloud proxy denied the required hosts. No crawl followed the denied robots requests.',
        '- The onboarding configuration draft is unavailable; no network change was saved or applied.', '',
        '## Provenance', '', '| Website / scope | Retained file | Capture state | Current verification |', '| --- | --- | --- | --- |',
        *[f'| {facts["website"]} / {facts["scope"]} | [{facts["file"]}](../{facts["file"]}) | {facts["captureStatus"]} | UNVERIFIED; live access blocked |' for facts, _ in snapshots], '',
        'SHA-256 hashes, evidence identifiers when issued, observed controls and limitations are retained in [evidence-index.json](calculator-audit-data/evidence-index.json). A partial browser-provider response is not a completed runtime test. Historical dates are not fresh verification dates.', '',
        '## Historical interface findings', '',
    ]
    for url, profile in profiles.items():
        detail += [f'### {source_by_url[url]["toolName"]}', '', f'Observed source: {url}', '', f'Historical finding: {profile["historicalFinding"]}', '', f'Existing canonical tools: {", ".join("`" + item + "`" for item in profile["existingToolIds"])}.', '', 'Current final comparison: **UNVERIFIED**. The retained interface supports a partial-overlap finding, but current full competitor behavior is not certified.', '']
    detail += [
        '## Duplicate policy', '',
        'Canonicalize exact observed names and a very small documented synonym set only for discovery. Keep both source references. Never promote name grouping to functional equivalence without comparing formula, inputs, outputs, units and assumptions. Existing aliases resolve to canonical routes and must not get new pages.', '',
        'Notable traps checked: EMI already includes reducing-balance payment totals; the loan schedule already amortizes monthly; HCF/GCD and LCM aliases exist; binary/hex conversion is not arithmetic; population variance is not a t-test; a random coin flip is not a binomial probability calculator; word frequency is not wave frequency; recipe scaling already covers the stated ingredient-scaling purpose.', '',
        '## Candidate-by-candidate source-code review', '',
        'The “project coverage” column concerns only the user-provided purpose, with limitations documented in JSON/CSV. The final comparison remains UNVERIFIED. A blank source reference means no actual official URL was observed for that candidate; none has been invented.', '',
        '| # | Candidate | Project coverage | Existing implementation(s) | Observed official link | Final comparison |', '| ---: | --- | --- | --- | --- | --- |',
        *[f'| {row["number"]} | {safe(row["toolName"])} | {row["projectCoverageStatus"]} | {safe(", ".join(row["existingToolIds"]))} | {safe("; ".join(ref["sourceUrl"] for ref in row["competitorReferences"]))} | UNVERIFIED |' for row in candidates], '',
        '## Missing-only deliverables', '',
        '[all-missing-calculators.csv](all-missing-calculators.csv) and [all-missing-calculators.json](all-missing-calculators.json) contain no confirmed rows. The full missing total is unknown, not zero. Detailed project-coverage notes are in [calculator-candidate-comparison.json](calculator-candidate-comparison.json).', '',
        '## Required access to continue', '',
        'Allow these hostnames in the cloud environment network settings while preserving existing allowed destinations: ' + ', '.join('`' + host + '`' for host in NETWORK['requiredAllowedDomains']) + '.', '',
        'After a supported configuration update, retry robots.txt once, review terms and crawl directives, then fetch official sitemaps/category listings with per-host rate limiting. Respect a larger advertised crawl delay, cache responses, follow only allowed public links, stop on challenge/access-denied/rate-limit responses, and mark unavailable pages UNVERIFIED. Do not guess endpoints or bypass restrictions.', '',
        'Only after a current inventory, six-state comparison and per-tool specifications are established should the first 20 confirmed missing calculators be selected. Preserve the five main categories and use existing subcategories; extend partial matches instead of cloning them.',
    ]
    (REPORTS / 'calculator-competitor-audit.md').write_text('\n'.join(detail) + '\n')
    readiness = [
        '# Calculator implementation readiness', '', '**Requested batch: 20. Approved-by-evidence selection: none yet. Status: blocked on competitor verification.**', '',
        'After the initial audit, the user explicitly requested 20 tools. An original batch is now implemented; see calculator-batch-one.md and calculator-specifications/. The separate competitor census remains blocked and no confirmed competitor-gap selection is asserted.', '',
        '## Admission gate for each implementation', '',
        '1. Verify an actual official listing and destination page under permitted access; record date, URL and evidence scope.',
        '2. Inspect existing runner code and its fields/outputs, including aliases and embedded workbook functions. Record one of the six required statuses.',
        '3. Confirm MISSING rather than a differently named, equivalent or partial existing feature. Partial tools enter an extension queue.',
        '4. Write a complete original specification: required/optional fields, typed units, bounds/defaults, finite/range/zero-denominator checks, formula with definitions and assumptions, calculation steps and output precision.',
        '5. Include an accessible form, reset, result card, formula, worked example, explanation, FAQs, related canonical tools, mobile behavior, metadata/canonical path and appropriate structured data.',
        '6. Attach at least five independent expected-result and edge-case tests. Cover empty, zero, negative, extreme and decimal inputs where meaningful; check an independent numerical oracle for advanced distributions/solvers.',
        '7. Rank only the confirmed missing pool; select 20 in small reviewable batches, using current JavaScript/Next.js conventions and existing helpers.',
        '8. Run targeted calculator tests, the existing suite, lint, production/static build and 320/390/desktop browser checks; ensure discovery/search, category counts, schema and sitemap remain consistent.', '',
        '## Merge/extension cautions already identified', '',
        '- Vehicle, education, business and fixed-rate equity-loan payments share the existing EMI engine. Verify domain-specific extras before making pages.',
        '- Prefer an extended percentage form over another basic percentage implementation.',
        '- Add recurring extra-payment modes to existing repayment/prepayment tools if verified.',
        '- Review polynomial/synthetic division as modes of one operation, pre/post-money as a paired valuation solver, and AdSense/YouTube as manual-RPM scenarios before deciding on separate canonical tools.',
        '- Clinical calculators require specialist review. Tax/pension rules, atomic data, emission factors and AI water-use models require dated authoritative references. Do not fabricate universal defaults.', '',
        '## Resume commands', '', '```sh', 'node scripts/calculator-audit/export-existing.mjs', 'python scripts/calculator-audit/build_reports.py', 'python -m unittest discover -s scripts/calculator-audit -p "test_*.py" -v', '```', '',
        'These commands regenerate and validate only the available-evidence report. They do not fetch blocked sites, complete the census, verify formulas automatically or implement calculators. Input source annotations must be reviewed when new evidence arrives.',
    ]
    (REPORTS / 'calculator-implementation-readiness.md').write_text('\n'.join(readiness) + '\n')
    print(json.dumps({'existing': inventory['counts'], 'observedSourceLinks': dict(counts), 'canonicalNameGroups': len(master), 'candidates': len(candidates), 'projectCoverage': dict(coverage_counts), 'auditComplete': False, 'confirmedMissingTotal': None}))


if __name__ == '__main__':
    build()
