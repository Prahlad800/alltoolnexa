"""Read retained public-page observations; never execute competitor scripts."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOTS = [
    ('research/competitors/evidence/02.json', 'Calculator.net', 'https://www.calculator.net/', 'homepage'),
    ('research/competitors/tool-evidence/02.json', 'Calculator.net', 'https://www.calculator.net/mortgage-calculator.html', 'calculator'),
    ('research/competitors/evidence/12.json', 'Omni', 'https://www.omnicalculator.com/', 'homepage'),
    ('research/competitors/tool-evidence/12.json', 'Omni', 'https://www.omnicalculator.com/math/percentage', 'calculator'),
]
OMNI_CATEGORIES = {
    'math': 'Mathematics', 'finance': 'Finance', 'physics': 'Physics',
    'health': 'Health', 'conversion': 'Unit Conversion', 'everyday-life': 'Everyday Life',
    'other': 'Other', 'statistics': 'Statistics', 'construction': 'Construction',
    'biology': 'Biology', 'sports': 'Sports', 'chemistry': 'Chemistry',
    'food': 'Food', 'ecology': 'Ecology',
}
NET_CATEGORIES = {
    '/financial-calculator.html': 'Financial Calculators',
    '/fitness-and-health-calculator.html': 'Fitness & Health Calculators',
    '/math-calculator.html': 'Math Calculators',
    '/other-calculator.html': 'Other Calculators',
}


def collapse(text):
    return ' '.join(text.split())


class PageFacts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.inputs, self.headings, self.body_text = [], [], [], []
        self.title, self.current_link, self.heading, self.label = '', None, None, None
        self.labels, self.label_stack, self.hidden_depth = {}, [], 0
        self.read_title = False
        self.select = None

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag in ('script', 'style'):
            self.hidden_depth += 1
        if tag == 'title' and not self.title:
            self.read_title = True
        if tag == 'a':
            self.current_link = {'href': data.get('href', ''), 'aria': data.get('aria-label', ''), 'parts': [], 'heading': ''}
        if re.fullmatch(r'h[1-6]', tag):
            self.heading = {'tag': tag, 'parts': []}
        if tag == 'label':
            self.label = {'for': data.get('for'), 'parts': [], 'controls': []}
        if tag in ('input', 'select', 'textarea'):
            field = {key: data.get(key) for key in ('id', 'name', 'type', 'value', 'min', 'max', 'step', 'aria-label', 'placeholder') if key in data}
            field.update(tag=tag, required_attribute='required' in data, label=None)
            if tag == 'select':
                field['options'] = []
                self.select = field
            self.inputs.append(field)
            if self.label:
                self.label['controls'].append(field)
        if tag == 'option' and self.select is not None:
            self.select['options'].append({'value': data.get('value'), 'label': ''})

    def handle_data(self, text):
        if self.read_title:
            self.title += text
        if self.hidden_depth:
            return
        self.body_text.append(text)
        if self.current_link:
            self.current_link['parts'].append(text)
        if self.heading:
            self.heading['parts'].append(text)
        if self.label:
            self.label['parts'].append(text)
        if self.select and self.select['options']:
            self.select['options'][-1]['label'] += text

    def handle_endtag(self, tag):
        if tag == 'title':
            self.read_title = False
        if tag in ('script', 'style'):
            self.hidden_depth = max(0, self.hidden_depth - 1)
        if tag == 'select':
            self.select = None
        if tag == 'a' and self.current_link:
            self.current_link['text'] = collapse(' '.join(self.current_link.pop('parts')))
            self.links.append(self.current_link)
            self.current_link = None
        if re.fullmatch(r'h[1-6]', tag) and self.heading:
            text = collapse(' '.join(self.heading['parts']))
            self.headings.append({'tag': self.heading['tag'], 'text': text})
            if self.current_link:
                self.current_link['heading'] = text
            self.heading = None
        if tag == 'label' and self.label:
            text = collapse(' '.join(self.label['parts']))
            if self.label['for']:
                self.labels[self.label['for']] = text
            for field in self.label['controls']:
                field['label'] = text
            self.label = None

    def finish(self):
        for field in self.inputs:
            field['label'] = field['label'] or self.labels.get(field.get('id')) or field.get('aria-label')
            for option in field.get('options', []):
                option['label'] = collapse(option['label'])
        return self


def load_snapshot(relative, website, url, scope):
    raw_bytes = (ROOT / relative).read_bytes()
    outer = json.loads(raw_bytes)
    data = outer.get('structuredContent')
    if not data:
        data = next(json.loads(item['text']) for item in outer.get('content', []) if item.get('type') == 'text')
    html = []

    def walk(value):
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str) and value.lstrip().lower().startswith(('<!doctype html', '<html')):
            html.append(value)

    walk(data)
    if not html:
        raise ValueError(f'No retained HTML in {relative}')
    page = PageFacts()
    page.feed(max(html, key=len))
    page.finish()
    facts = {
        'file': relative, 'website': website, 'url': url, 'scope': scope,
        'evidenceId': data.get('evidence_id'), 'sha256': hashlib.sha256(raw_bytes).hexdigest(),
        'historicalCaptureDate': '2026-10-24',
        'captureStatus': 'partial_tooling_error' if 'error' in data else data.get('normalized_result', {}).get('completeness', {}).get('status', 'unknown'),
        'title': collapse(page.title), 'inputs': page.inputs,
        'inputCountIncludesHiddenControls': True,
        'runtimeCalculationTested': False,
    }
    return facts, page


def canonical_url(base, href):
    url = urlsplit(urljoin(base, href))
    if url.scheme != 'https' or url.hostname != urlsplit(base).hostname:
        return None
    return urlunsplit((url.scheme, url.netloc, url.path.rstrip('/') or '/', '', ''))


def observed_listing(facts, page):
    records, categories = [], {}
    current_category = 'Financial Calculators' if facts['website'] == 'Calculator.net' and facts['scope'] == 'calculator' else None
    for anchor in page.links:
        url = canonical_url(facts['url'], anchor['href'])
        if not url:
            continue
        parts = urlsplit(url).path.strip('/').split('/')
        pathname = urlsplit(url).path
        label = collapse(anchor['aria'] or anchor['heading'] or anchor['text'])
        if facts['website'] == 'Calculator.net':
            if pathname in NET_CATEGORIES:
                categories[pathname] = NET_CATEGORIES[pathname]
                current_category = NET_CATEGORIES[pathname]
                continue
            if not pathname.endswith(('-calculator.html', '-generator.html')) or not label:
                continue
            category = current_category
        else:
            if len(parts) == 1 and parts[0] in OMNI_CATEGORIES:
                categories[pathname] = OMNI_CATEGORIES[parts[0]]
            if len(parts) != 2 or parts[0] not in OMNI_CATEGORIES or not label:
                continue
            category = OMNI_CATEGORIES[parts[0]]
        # Homepage cards carry long descriptions; their heading is the observed
        # name. If no heading exists, retain only a bounded title-like label.
        if len(label) > 110:
            match = re.match(r'^(.{1,85}?Calculator(?:\s*\([^)]*\))?)\b', label, re.I)
            if not match:
                continue
            label = match.group(1)
        records.append({'toolName': label, 'sourceWebsite': facts['website'], 'sourceUrl': url, 'category': category, 'evidenceFile': facts['file'], 'urlVerification': 'archived_official_link', 'pageDetailsVerified': False})
    return records, [{'url': canonical_url(facts['url'], key), 'name': value} for key, value in categories.items()]


def read_all():
    return [load_snapshot(*entry) for entry in SNAPSHOTS]
