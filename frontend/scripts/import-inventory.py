"""Normalize the user's supplied tool ideas, preserving source categories."""
import json
import re
import sys
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
entries = {}
category = 'Uncategorized'
for line in source.read_text(encoding='utf-8-sig').splitlines():
    if re.match(r'^\d+\.\s', line):
        category = re.sub(r'^\d+\.\s*', '', line)
        category = re.sub(r'^[^A-Za-z0-9]+', '', category).strip()
    match = re.match(r'^\s+(?:\d+\.\s*|[•]\s*)(.+)', line)
    if not match:
        continue
    name = re.sub(r'^[^A-Za-z0-9]+', '', match[1])
    name = re.sub(r'\s*[🟢🟡🔴].*$', '', name).strip()
    name = name.replace(' — API', '').strip()
    key = unicodedata.normalize('NFKD', name.lower()).replace('→', ' to ')
    key = re.sub('[^a-z0-9]+', '-', key).strip('-')
    if not key:
        continue
    item = entries.setdefault(key, {'id': key, 'name': name, 'categories': [], 'occurrences': 0, 'status': 'planned'})
    item['occurrences'] += 1
    if category not in item['categories']:
        item['categories'].append(category)
target = root / 'shared' / 'inventory.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(list(entries.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(entries)} normalized ideas; {sum(e["occurrences"] for e in entries.values())} source entries.')
