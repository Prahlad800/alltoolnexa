"""Check audit provenance and prevent incomplete research becoming fake certainty."""
import csv
import hashlib
import json
import unittest
from pathlib import Path

from evidence import ROOT, PageFacts, canonical_url, observed_listing, read_all


def report(name):
    return json.loads((ROOT / 'reports' / name).read_text())


class AuditIntegrityTests(unittest.TestCase):
    def test_registry_counts_and_execution(self):
        data = report('calculator-audit-data/existing-tool-inventory.json')
        self.assertEqual(len(data['records']), 507)
        self.assertEqual(len({r['id'] for r in data['records']}), 507)
        counts = data['counts']
        self.assertEqual(counts['standaloneCalculators'], 248)
        self.assertEqual(counts['embeddedCalculationWorkspaces'], 2)
        self.assertEqual(counts['defaultExecutionsPassed'], 248)
        self.assertEqual(counts['defaultExecutionsFailed'], 0)
        self.assertEqual(len(report('existing-calculators.json')['records']), 248)

    def test_source_hashes_anchor_actual_code(self):
        for source in report('calculator-audit-data/existing-tool-inventory.json')['sourceFiles']:
            with self.subTest(file=source['file']):
                digest = hashlib.sha256((ROOT / source['file']).read_bytes()).hexdigest()
                self.assertEqual(digest, source['sha256'])

    def test_all_candidates_are_preserved_without_promotion(self):
        data = report('calculator-candidate-comparison.json')
        candidates = data['records']
        self.assertFalse(data['auditComplete'])
        self.assertEqual([r['number'] for r in candidates], list(range(1, 144)))
        ids = {r['id'] for r in report('calculator-audit-data/existing-tool-inventory.json')['records']}
        for row in candidates:
            with self.subTest(candidate=row['id']):
                self.assertEqual(row['comparisonStatus'], 'UNVERIFIED')
                self.assertTrue(set(row['existingToolIds']).issubset(ids))

    def test_competitor_urls_have_retained_anchor_provenance(self):
        observed = set()
        for facts, page in read_all():
            observed.update(row['sourceUrl'] for row in observed_listing(facts, page)[0])
        sources = [source for row in report('competitor-calculator-master.json')['records'] for source in row['sources']]
        self.assertEqual(len(sources), 70)
        self.assertEqual(len({s['sourceUrl'] for s in sources}), 70)
        for source in sources:
            self.assertIn(source['sourceUrl'], observed)
            self.assertFalse(source['livePageVerified'])
            self.assertEqual(source['comparisonStatus'], 'UNVERIFIED')

    def test_capture_errors_are_not_erased(self):
        snapshots = report('calculator-audit-data/evidence-index.json')['snapshots']
        self.assertEqual(len(snapshots), 4)
        failed = next(s for s in snapshots if s['file'] == 'research/competitors/tool-evidence/12.json')
        self.assertEqual(failed['captureStatus'], 'partial_tooling_error')
        self.assertFalse(failed['runtimeCalculationTested'])
        for snapshot in snapshots:
            self.assertEqual(snapshot['sha256'], hashlib.sha256((ROOT / snapshot['file']).read_bytes()).hexdigest())

    def test_missing_export_does_not_claim_zero_gaps(self):
        missing = report('all-missing-calculators.json')
        self.assertFalse(missing['auditComplete'])
        self.assertIsNone(missing['completeUniqueMissingTotal'])
        self.assertTrue(missing['implementationBlocked'])
        self.assertEqual(missing['records'], [])
        with (ROOT / 'reports/all-missing-calculators.csv').open(newline='') as stream:
            reader = csv.DictReader(stream)
            self.assertEqual(len(reader.fieldnames), 17)
            self.assertEqual(list(reader), [])
        batch = report('calculator-audit-data/summary.json')['implementationBatch']
        self.assertEqual(batch['selected'], [])
        self.assertEqual(batch['implemented'], [])

    def test_url_normalization_rejects_external_and_non_https(self):
        base = 'https://www.calculator.net/'
        self.assertIsNone(canonical_url(base, 'https://example.com/x-calculator.html'))
        self.assertIsNone(canonical_url(base, 'http://www.calculator.net/x-calculator.html'))
        self.assertEqual(canonical_url(base, '/bmi-calculator.html?x=1#result'), base + 'bmi-calculator.html')

    def test_listing_excludes_category_and_author_pages(self):
        page = PageFacts()
        page.feed('<a href="/math">Math</a><a href="/authors/person">Person</a><a href="/math/percentage">Percentage Calculator</a>')
        page.finish()
        records, categories = observed_listing({'website': 'Omni', 'scope': 'homepage', 'url': 'https://www.omnicalculator.com/', 'file': 'fixture'}, page)
        self.assertEqual([r['sourceUrl'] for r in records], ['https://www.omnicalculator.com/math/percentage'])
        self.assertEqual(len(categories), 1)

    def test_local_report_links_resolve(self):
        import re
        for path in (ROOT / 'reports').glob('*.md'):
            for link in re.findall(r'\]\(([^)]+)\)', path.read_text()):
                if '://' in link or link.startswith('#'):
                    continue
                self.assertTrue((path.parent / link.split('#')[0]).exists(), f'{path.name}: {link}')


if __name__ == '__main__':
    unittest.main()
