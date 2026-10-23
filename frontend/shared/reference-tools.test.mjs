import test from 'node:test';
import assert from 'node:assert/strict';
import {lineDiff, passwordStrength, textToBinary, binaryToText, generateRobots, generateSitemap, generateSchema, generateHreflang, generateOpenGraph, generateTwitterCard, serpPreview, analyzeHTMLSEO, extendReferenceTools} from './reference-tools.mjs';

test('line diff produces a minimal stable edit script, including empty and final lines', () => {
  const result = lineDiff('a\nb\na', 'a\na');
  assert.equal(result.added, 0); assert.equal(result.removed, 1); assert.equal(result.unchanged, 2);
  assert.equal(result.diff, '  a\n- b\n  a');
  assert.equal(lineDiff('', 'hello').diff, '+ hello');
  assert.equal(lineDiff('hello', '').diff, '- hello');
  assert.equal(lineDiff('', '').diff, '');
  assert.equal(lineDiff('a\r\nb', 'a\nb').unchanged, 2);
  assert.equal(lineDiff('a', 'a\n').added, 1);
  assert.throws(() => lineDiff(Array(401).fill('line').join('\n'), ''), /400 lines/);
  assert.throws(() => lineDiff('x'.repeat(100001), ''), /100,000/);
});

test('password scoring is a non-disclosing heuristic and penalizes known simple patterns', () => {
  const strong = passwordStrength('Pine!Cobalt7-Orbit$Pebble');
  assert.equal(strong.score, '4/4');
  assert.match(strong.limitation, /does not check breaches/i);
  assert.ok(!JSON.stringify(strong).includes('Pine!Cobalt'));
  assert.equal(passwordStrength('').score, '0/4');
  assert.equal(passwordStrength('Password123456!').score, '0/4');
  assert.equal(passwordStrength('abcabcabcabcabcabc').score, '1/4');
  assert.equal(passwordStrength('🌿🌿🌿🌿').characters, 4);
  assert.throws(() => passwordStrength('x'.repeat(1025)), /1,024/);
});

test('binary conversion round-trips Unicode and BOM bytes; invalid UTF-8 is rejected', () => {
  for (const text of ['', 'Hello', 'नमस्ते 🌿 café', '\ufeffwith BOM', '\u0000\n']) {
    assert.equal(binaryToText(textToBinary(text)), text);
  }
  assert.equal(textToBinary('A'), '01000001');
  assert.equal(binaryToText('0100000101000010'), 'AB');
  assert.equal(binaryToText('01000001\n01000010'), 'AB');
  assert.throws(() => binaryToText('0101'), /complete 8-bit/);
  assert.throws(() => binaryToText('0100 0001'), /8-bit bytes/);
  assert.throws(() => binaryToText('01000002'), /binary digits/);
  assert.throws(() => binaryToText('11000000 10101111'), /not valid UTF-8/);
  assert.throws(() => binaryToText('11101101 10100000 10000000'), /not valid UTF-8/);
  assert.throws(() => textToBinary('\ud800'), /unpaired Unicode/);
  assert.throws(() => textToBinary('🌿'.repeat(20000)), /65,536/);
});

test('robots generation validates syntax and cannot inject extra directives', () => {
  const output = generateRobots({agents: '*\nGooglebot', allow: '/public/', disallow: '/admin/\n/private/*$', sitemaps: 'https://example.com/sitemap.xml'});
  assert.equal(output, 'User-agent: *\nUser-agent: Googlebot\nAllow: /public/\nDisallow: /admin/\nDisallow: /private/*$\n\nSitemap: https://example.com/sitemap.xml\n');
  assert.equal(generateRobots({agents: '*'}), 'User-agent: *\nDisallow:\n');
  assert.throws(() => generateRobots({agents: '*\nDisallow: /'}), /user-agent tokens/);
  assert.throws(() => generateRobots({agents: '*', disallow: '/admin # comment'}), /without spaces/);
  assert.throws(() => generateRobots({agents: '*', sitemaps: 'javascript:alert(1)'}), /http or https/);
});

test('sitemaps deduplicate normalized URLs, escape XML and reject invalid dates/origins', () => {
  const xml = generateSitemap({urls: 'https://example.com\nhttps://example.com/\nhttps://example.com/search?a=1&b=2', lastmod: '2024-02-29', frequency: 'monthly', priority: '0.7'});
  assert.equal((xml.match(/<url>/g) || []).length, 2);
  assert.match(xml, /<loc>https:\/\/example.com\/search\?a=1&amp;b=2<\/loc>/);
  assert.match(xml, /<lastmod>2024-02-29<\/lastmod>/);
  assert.throws(() => generateSitemap({urls: 'https://example.com/', lastmod: '2023-02-29'}), /calendar date/);
  assert.throws(() => generateSitemap({urls: 'https://example.com/', priority: 2}), /between 0 and 1/);
  assert.throws(() => generateSitemap({urls: 'https://example.com/\nhttps://other.example/'}), /one origin/);
  assert.throws(() => generateSitemap({urls: 'https://user:secret@example.com/'}), /username or password/);
  assert.throws(() => generateSitemap({urls: 'https://example.com/#fragment'}), /fragment/);
  assert.throws(() => generateSitemap({urls: 'https://example.com/a b'}), /whitespace/);
});

test('typed schemas use supplied facts and escape HTML script boundaries without corrupting JSON', () => {
  const output = generateSchema({type: 'Article', name: '</script><script>alert(1)</script>', url: 'https://example.com/post', description: 'A & B', author: 'Asha'});
  assert.ok(!output.includes('</script>'));
  const schema = JSON.parse(output);
  assert.equal(schema['@type'], 'Article');
  assert.equal(schema.headline, '</script><script>alert(1)</script>');
  assert.deepEqual(schema.author, {'@type': 'Person', name: 'Asha'});
  assert.ok(!('datePublished' in schema));
  assert.equal(JSON.parse(generateSchema({type: 'Person', name: 'Ravi', url: 'https://example.com/'})).name, 'Ravi');
  assert.throws(() => generateSchema({type: 'Unknown', name: 'A', url: 'https://example.com/'}), /Choose Organization/);
  assert.throws(() => generateSchema({name: '', url: 'https://example.com/'}), /required/);
});

test('hreflang output canonicalizes tags, handles x-default and rejects duplicate/injected languages', () => {
  const output = generateHreflang('en-us | https://example.com/en/?a=1&b=2\nhi-IN | https://example.com/hi/\nx-default | https://example.com/');
  assert.match(output, /hreflang="en-US"/);
  assert.match(output, /a=1&amp;b=2/);
  assert.match(output, /hreflang="x-default"/);
  assert.throws(() => generateHreflang('en-us | https://example.com/\nen-US | https://example.com/us/'), /Duplicate language/);
  assert.throws(() => generateHreflang('en\" onload=\"x | https://example.com/'), /language tag/);
  assert.throws(() => generateHreflang('en | javascript:alert(1)'), /http or https/);
  assert.throws(() => generateHreflang('en https://example.com/'), /language \| absolute URL/);
});

test('Open Graph and Twitter metadata escape attributes and validate optional URL/handle values', () => {
  const og = generateOpenGraph({title: '\" & <script>', description: 'line 1\nline 2', url: 'https://example.com/?a=1&b=2', image: 'https://example.com/image.jpg', site: 'A & B', type: 'article'});
  assert.match(og, /content="&quot; &amp; &lt;script&gt;"/);
  assert.match(og, /og:type" content="article"/);
  assert.match(og, /content="line 1 line 2"/);
  assert.ok(!og.includes('<script>'));
  assert.throws(() => generateOpenGraph({title: 'A', url: 'javascript:alert(1)'}), /http or https/);
  assert.throws(() => generateOpenGraph({title: 'A', url: 'https://example.com/', type: 'video'}), /website or article/);
  const twitter = generateTwitterCard({title: 'A', card: 'summary', site: '@example'});
  assert.match(twitter, /twitter:card" content="summary"/);
  assert.ok(!twitter.includes('twitter:image'));
  assert.throws(() => generateTwitterCard({title: 'A', site: '@invalid-handle'}), /site handle/);
  assert.throws(() => generateTwitterCard({title: 'A', image: 'data:image/png;base64,abc'}), /http or https/);
});

test('SERP preview counts code points and explicitly avoids ranking claims', () => {
  const result = serpPreview({title: 'A 🌿', description: 'Text', url: 'https://example.com/tools?q=a'});
  assert.equal(result.titleCharacters, 3);
  assert.equal(result.displayURL, 'example.com/tools?q=a');
  assert.match(result.note, /does not query rankings/);
});

test('static HTML checks ignore comments/raw scripts and understand quoted angle brackets', () => {
  const result = analyzeHTMLSEO('<html lang="en"><head><!-- <title>fake</title> --><script>const fake = "<h1><img><title>bad</title>"; const tricky = "</scriptx><img>";</script><title>A &amp; B</title><meta name="description" content="Two > one"><meta name="viewport" content="width=device-width"><link rel="canonical" href="/page?a=1&amp;b=2"></head><body><h1>Hello</h1><img alt="" src="decorative.png"><img src="meaningful.png"><a href="/next">Next</a></body></html>', 'https://example.com/base/');
  assert.equal(result.title, 'A & B');
  assert.equal(result.description, 'Two > one');
  assert.equal(result.headings.h1, 1);
  assert.equal(result.imageCount, 2);
  assert.equal(result.imagesMissingAlt, 1);
  assert.equal(result.linkCount, 1);
  assert.deepEqual(result.canonicalURLs, ['https://example.com/page?a=1&b=2']);
  assert.equal(result.checks.find(check => check.check === 'Page title').status, 'pass');
  assert.equal(result.checks.find(check => check.check === 'Image alt attributes').status, 'review');
  assert.match(result.scope, /No URLs are fetched/);
});

test('HTML checker reports duplicate metadata, indexing restrictions and unresolved canonicals', () => {
  const result = analyzeHTMLSEO('<head><title>A</title><title>B</title><meta name=description content=first><meta name=description content=second><meta name=robots content="noindex, follow"><link rel=canonical href=/relative></head><body><h1>A</h1><h1>B</h1></body>');
  assert.equal(result.checks.find(check => check.check === 'Page title').status, 'review');
  assert.equal(result.checks.find(check => check.check === 'Meta description').status, 'review');
  assert.equal(result.checks.find(check => check.check === 'Robots indexing directive').status, 'review');
  assert.match(result.canonicalURLs[0], /^Invalid or unresolved/);
  assert.equal(result.headings.h1, 2);
  assert.throws(() => analyzeHTMLSEO(''), /required/);
  assert.throws(() => analyzeHTMLSEO('<p>'.repeat(5001)), /5,000 HTML tags/);
  assert.throws(() => analyzeHTMLSEO('x'.repeat(200001)), /200,000/);
});

test('reference registrations have working examples, unique IDs and resolvable aliases', async () => {
  const tools = [], runners = new Map(), aliases = {};
  const field = (key, label, value = '', type = 'number', options) => ({key, label, value, type, ...(options ? {options} : {})});
  extendReferenceTools({field, aliases, register(category, name, fields, formula, run, extra = {}) {
    const id = extra.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    assert.ok(!runners.has(id), id); runners.set(id, run); tools.push({id, category, fields, formula, ...extra});
  }});
  assert.equal(tools.length, 12);
  for (const tool of tools) {
    assert.ok(tool.formula.length > 20);
    assert.equal(new Set(tool.fields.map(field => field.key)).size, tool.fields.length);
    const output = await runners.get(tool.id)(Object.fromEntries(tool.fields.map(field => [field.key, String(field.value)])));
    assert.notEqual(output, undefined, tool.id);
  }
  for (const target of Object.values(aliases)) assert.ok(runners.has(target), target);
});
