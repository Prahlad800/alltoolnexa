import {date, escapeHTML, httpURL, number} from './core.mjs';

function boundedText(value, label, max = 100000) {
  const text = String(value ?? '');
  if (text.length > max) throw Error(`${label} must contain at most ${max.toLocaleString('en-US')} characters.`);
  return text;
}

function requiredText(value, label, max = 2000) {
  const text = boundedText(value, label, max).trim();
  if (!text) throw Error(`${label} is required.`);
  return text;
}

function metadataText(value, label, max = 2000, required = false) {
  const text = boundedText(value, label, max).trim().replace(/\s+/gu, ' ');
  if (required && !text) throw Error(`${label} is required.`);
  return text;
}

function safeURL(value, label = 'URL') {
  const input = requiredText(value, label, 2048);
  if (/[\u0000-\u0020\u007f]/u.test(input)) throw Error(`${label} cannot contain whitespace or control characters; encode spaces as %20.`);
  let url;
  try { url = httpURL(input); } catch { throw Error(`${label} must be an absolute http or https URL.`); }
  if (url.username || url.password) throw Error(`${label} cannot contain a username or password.`);
  if (url.hash) throw Error(`${label} cannot contain a fragment (#).`);
  if (!url.hostname) throw Error(`${label} must include a hostname.`);
  return url.toString();
}

function nonemptyLines(value, label, maxLines = 500, maxCharacters = 100000) {
  const lines = boundedText(value, label, maxCharacters).split(/\r\n|\r|\n/u).map(line => line.trim()).filter(Boolean);
  if (lines.length > maxLines) throw Error(`${label} allows at most ${maxLines} nonempty lines.`);
  return lines;
}

/** Exact line comparison with an intentionally bounded longest-common-subsequence table. */
export function lineDiff(original, revised) {
  const split = (value, label) => {
    const text = boundedText(value, label).replace(/\r\n|\r/gu, '\n');
    const lines = text === '' ? [] : text.split('\n');
    if (lines.length > 400) throw Error('Compare at most 400 lines on each side.');
    return lines;
  };
  const before = split(original, 'Original text'), after = split(revised, 'Revised text');
  const width = after.length + 1, table = new Uint16Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = before[i] === after[j]
        ? 1 + table[(i + 1) * width + j + 1]
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  let i = 0, j = 0, added = 0, removed = 0, unchanged = 0;
  const output = [];
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      output.push('  ' + before[i]); i++; j++; unchanged++;
    } else if (i < before.length && (j === after.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      output.push('- ' + before[i++]); removed++;
    } else { output.push('+ ' + after[j++]); added++; }
  }
  return {added, removed, unchanged, diff: output.join('\n'), method: 'Exact line comparison; CRLF and CR are normalized to LF. A final newline counts as an empty final line.'};
}

/** A transparent local heuristic, deliberately not an entropy or breach estimate. */
export function passwordStrength(value) {
  const password = boundedText(value, 'Password', 1024), length = Array.from(password).length;
  const groups = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter(pattern => pattern.test(password)).length;
  let score = Number(length >= 8) + Number(length >= 12) + Number(length >= 16) + Number(groups >= 3);
  const notes = [];
  if (length < 12) notes.push('Use more characters; a long unique passphrase can be easier to remember.');
  if (groups < 3) notes.push('Character variety is limited; length and uniqueness still matter.');
  const common = /(?:password|qwerty|letmein|welcome|admin|iloveyou|123456)/iu.test(password);
  const repeated = /^(.)\1{3,}$/u.test(password) || /^(.{1,4})\1{2,}$/u.test(password);
  const sequence = /(?:012345|123456|234567|345678|456789|abcdef|qwerty|asdfgh)/iu.test(password);
  if (common) { score = Math.min(score, 1); notes.push('Contains a common password word or pattern.'); }
  if (repeated) { score = Math.min(score, 1); notes.push('Repeats the same character or short block.'); }
  if (sequence) { score = Math.max(0, score - 1); notes.push('Contains a simple keyboard, number or alphabet sequence.'); }
  if (!password) { score = 0; notes.push('Enter a password to inspect.'); }
  notes.push('Use a unique password for each account and enable multifactor authentication when available.');
  return {rating: ['Very weak', 'Weak', 'Moderate', 'Good heuristic score', 'Higher heuristic score'][score], score: `${score}/4`, characters: length, characterGroups: groups, notes, limitation: 'A local length-and-pattern heuristic. This does not check breaches, predict cracking time or prove that a password is secure.'};
}

function assertUnicode(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw Error('Text contains an unpaired Unicode surrogate.');
    } else if (code >= 0xdc00 && code <= 0xdfff) throw Error('Text contains an unpaired Unicode surrogate.');
  }
}

export function textToBinary(value) {
  const text = boundedText(value, 'Text', 50000);
  assertUnicode(text);
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 65536) throw Error('Use at most 65,536 UTF-8 bytes.');
  return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join(' ');
}

export function binaryToText(value) {
  const text = boundedText(value, 'Binary input', 600000).trim();
  if (!text) return '';
  if (/[^01\s]/u.test(text)) throw Error('Use only binary digits and whitespace.');
  const groups = text.split(/\s+/u);
  let bits;
  if (groups.length > 1) {
    if (groups.some(group => group.length !== 8)) throw Error('Separate complete 8-bit bytes with whitespace, or enter one continuous bit string.');
    bits = groups.join('');
  } else bits = groups[0];
  if (bits.length % 8 !== 0) throw Error('Binary input must contain complete 8-bit bytes.');
  if (bits.length > 65536 * 8) throw Error('Use at most 65,536 UTF-8 bytes.');
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  try { return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes); }
  catch { throw Error('These bytes are not valid UTF-8 text.'); }
}

export function generateRobots(values) {
  const agents = nonemptyLines(values.agents, 'User agents', 20, 5000);
  if (!agents.length || agents.some(agent => !/^[A-Za-z0-9_.*-]+$/u.test(agent))) throw Error('Enter user-agent tokens such as * or Googlebot, one per line.');
  const paths = key => nonemptyLines(values[key], key === 'allow' ? 'Allowed paths' : 'Disallowed paths', 100).map(path => {
    if (path.length > 1000 || !/^[/*]/u.test(path) || /[\s#\u0000-\u001f\u007f]/u.test(path)) throw Error('Rules must start with / or *, without spaces, comments or control characters.');
    return path;
  });
  const allow = paths('allow'), disallow = paths('disallow');
  const sitemaps = nonemptyLines(values.sitemaps, 'Sitemap URLs', 10, 25000).map(url => safeURL(url, 'Sitemap URL'));
  return [...agents.map(agent => `User-agent: ${agent}`), ...allow.map(path => `Allow: ${path}`), ...(disallow.length ? disallow.map(path => `Disallow: ${path}`) : ['Disallow:']), ...(sitemaps.length ? ['', ...sitemaps.map(url => `Sitemap: ${url}`)] : [])].join('\n') + '\n';
}

export function generateSitemap(values) {
  const lines = nonemptyLines(values.urls, 'Page URLs', 500);
  if (!lines.length) throw Error('Enter at least one absolute page URL.');
  const urls = [...new Set(lines.map(url => safeURL(url, 'Page URL')))];
  const origin = new URL(urls[0]).origin;
  if (urls.some(url => new URL(url).origin !== origin)) throw Error('Use URLs from one origin (the same scheme, hostname and port) in each sitemap.');
  const lastmod = String(values.lastmod ?? '').trim();
  if (lastmod) date(lastmod);
  const frequency = String(values.frequency ?? 'not set');
  if (!['not set', 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(frequency)) throw Error('Choose a supported change frequency.');
  const priority = number(values.priority ?? 0.5, 'Priority', 0, 1);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(url => `  <url>\n    <loc>${escapeHTML(url)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${frequency !== 'not set' ? `\n    <changefreq>${frequency}</changefreq>` : ''}\n    <priority>${priority}</priority>\n  </url>`).join('\n') + '\n</urlset>\n';
}

function safeJSON(value) { return JSON.stringify(value, null, 2).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029'); }

export function generateSchema(values) {
  const type = String(values.type ?? 'Organization');
  if (!['Organization', 'Person', 'Article', 'WebSite'].includes(type)) throw Error('Choose Organization, Person, Article or WebSite.');
  const name = requiredText(values.name, type === 'Article' ? 'Headline' : 'Name', 300);
  const url = safeURL(values.url), description = metadataText(values.description, 'Description');
  const image = String(values.image ?? '').trim(), author = metadataText(values.author, 'Author name', 300);
  const schema = {'@context': 'https://schema.org', '@type': type, ...(type === 'Article' ? {headline: name} : {name}), url};
  if (description) schema.description = description;
  if (image) schema.image = safeURL(image, 'Image URL');
  if (type === 'Article' && author) schema.author = {'@type': 'Person', name: author};
  return safeJSON(schema);
}

export function generateHreflang(value) {
  const rows = nonemptyLines(value, 'Language and URL pairs', 100);
  if (!rows.length) throw Error('Enter at least one language | URL pair.');
  const seen = new Set();
  return rows.map(row => {
    const parts = row.split('|');
    if (parts.length !== 2) throw Error('Use language | absolute URL on each line.');
    let language = parts[0].trim();
    if (language.toLowerCase() === 'x-default') language = 'x-default';
    else {
      if (!/^[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?$/iu.test(language)) throw Error('Use a language tag such as en, hi-IN, zh-Hant or x-default.');
      try { language = Intl.getCanonicalLocales(language)[0]; } catch { throw Error('Enter a valid language tag.'); }
    }
    if (seen.has(language)) throw Error(`Duplicate language tag: ${language}.`);
    seen.add(language);
    return `<link rel="alternate" hreflang="${language}" href="${escapeHTML(safeURL(parts[1], 'Alternate URL'))}">`;
  }).join('\n');
}

const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHTML(value)}">`;

export function generateOpenGraph(values) {
  const title = metadataText(values.title, 'Title', 300, true), description = metadataText(values.description, 'Description');
  const url = safeURL(values.url), image = String(values.image ?? '').trim(), site = metadataText(values.site, 'Site name', 300);
  const type = String(values.type ?? 'website');
  if (!['website', 'article'].includes(type)) throw Error('Choose website or article.');
  return [meta('property', 'og:title', title), meta('property', 'og:type', type), meta('property', 'og:url', url), ...(description ? [meta('property', 'og:description', description)] : []), ...(image ? [meta('property', 'og:image', safeURL(image, 'Image URL'))] : []), ...(site ? [meta('property', 'og:site_name', site)] : [])].join('\n');
}

export function generateTwitterCard(values) {
  const card = String(values.card ?? 'summary_large_image');
  if (!['summary', 'summary_large_image'].includes(card)) throw Error('Choose a supported Twitter/X card type.');
  const title = metadataText(values.title, 'Title', 300, true), description = metadataText(values.description, 'Description');
  const image = String(values.image ?? '').trim(), site = String(values.site ?? '').trim();
  if (site && !/^@[A-Za-z0-9_]{1,15}$/u.test(site)) throw Error('Enter a site handle such as @example, up to 15 letters, digits or underscores.');
  return [meta('name', 'twitter:card', card), meta('name', 'twitter:title', title), ...(description ? [meta('name', 'twitter:description', description)] : []), ...(image ? [meta('name', 'twitter:image', safeURL(image, 'Image URL'))] : []), ...(site ? [meta('name', 'twitter:site', site)] : [])].join('\n');
}

export function serpPreview(values) {
  const title = metadataText(values.title, 'Title', 300, true), description = metadataText(values.description, 'Description');
  const canonicalURL = safeURL(values.url), url = new URL(canonicalURL);
  return {title, titleCharacters: Array.from(title).length, displayURL: url.host + url.pathname + url.search, description, descriptionCharacters: Array.from(description).length, canonicalURL, note: 'Text preview only. Search engines can rewrite or truncate titles and descriptions. This does not query rankings or reproduce exact search-result pixels.'};
}

// Bounded static-source inspection, not a browser HTML parser or conformance validator.
function htmlTokens(html) {
  const tokens = [], lower = html.toLowerCase();
  let position = 0;
  while (position < html.length) {
    const start = html.indexOf('<', position);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) { const end = html.indexOf('-->', start + 4); position = end < 0 ? html.length : end + 3; continue; }
    let end = start + 1, quote = '';
    for (; end < html.length; end++) {
      const character = html[end];
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    if (end === html.length) break;
    position = end + 1;
    const raw = html.slice(start + 1, end), match = /^\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/iu.exec(raw);
    if (!match) continue;
    const name = match[2].toLowerCase(), closing = Boolean(match[1]), attrs = Object.create(null);
    if (!closing) {
      const source = raw.slice(match[0].length);
      const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu;
      for (const attribute of source.matchAll(pattern)) {
        const key = attribute[1].toLowerCase();
        if (!(key in attrs)) attrs[key] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
      }
    }
    tokens.push({name, closing, attrs, start, end: end + 1});
    if (tokens.length > 5000) throw Error('Inspect at most 5,000 HTML tags.');
    if (!closing && ['script', 'style', 'textarea', 'title'].includes(name)) {
      let closingStart = lower.indexOf(`</${name}`, position);
      while (closingStart >= 0 && !/[\s/>]/u.test(lower[closingStart + name.length + 2] || '')) closingStart = lower.indexOf(`</${name}`, closingStart + 2);
      if (closingStart < 0) { position = html.length; continue; }
      // Continue at the closing tag so apparent tags inside raw text are ignored.
      position = closingStart;
    }
  }
  return tokens;
}

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (entity, code) => {
    if (code[0] !== '#') return ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '})[code.toLowerCase()];
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd';
  });
}

export function analyzeHTMLSEO(value, pageURL = '') {
  const html = requiredText(value, 'HTML source', 200000), tokens = htmlTokens(html), starts = tokens.filter(token => !token.closing);
  const base = String(pageURL).trim() ? safeURL(pageURL, 'Page URL') : '';
  const titleTokens = starts.filter(token => token.name === 'title');
  const textFor = token => {
    if (!token) return '';
    const closing = tokens.find(next => next.closing && next.name === token.name && next.start >= token.end);
    return metadataText(decodeEntities(html.slice(token.end, closing?.start ?? token.end).replace(/<[^>]*>/gu, '')), 'Element text', 200000);
  };
  const title = textFor(titleTokens[0]);
  const descriptions = starts.filter(token => token.name === 'meta' && token.attrs.name?.toLowerCase() === 'description');
  const description = descriptions[0]?.attrs.content || '';
  const robots = starts.filter(token => token.name === 'meta' && ['robots', 'googlebot'].includes(token.attrs.name?.toLowerCase())).map(token => token.attrs.content || '');
  const canonicals = starts.filter(token => token.name === 'link' && token.attrs.rel?.toLowerCase().split(/\s+/u).includes('canonical'));
  const canonicalURLs = canonicals.map(token => {
    const href = token.attrs.href || '';
    try { if (!href.trim()) throw Error('Missing canonical href.'); return safeURL(base ? new URL(href, base).toString() : href, 'Canonical URL'); } catch { return `Invalid or unresolved: ${href}`; }
  });
  const images = starts.filter(token => token.name === 'img'), missingAlt = images.filter(token => !('alt' in token.attrs)).length;
  const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map(level => ['h' + level, starts.filter(token => token.name === 'h' + level).length]));
  const language = starts.find(token => token.name === 'html')?.attrs.lang || '';
  const viewport = starts.some(token => token.name === 'meta' && token.attrs.name?.toLowerCase() === 'viewport' && Boolean(token.attrs.content?.trim()));
  const noindex = robots.some(content => /(?:^|[\s,])(?:noindex|none)(?:$|[\s,])/iu.test(content));
  const checks = [
    {check: 'Page title', status: titleTokens.length === 1 && Boolean(title) ? 'pass' : 'review', detail: `${titleTokens.length} title element(s); ${Array.from(title).length} characters in the first.`},
    {check: 'Meta description', status: descriptions.length === 1 && Boolean(description.trim()) ? 'pass' : 'review', detail: `${descriptions.length} description tag(s); ${Array.from(description).length} characters in the first.`},
    {check: 'Main heading', status: headings.h1 === 1 ? 'pass' : 'review', detail: `${headings.h1} H1 element(s). Review the page structure in context.`},
    {check: 'Image alt attributes', status: missingAlt === 0 ? 'pass' : 'review', detail: `${missingAlt} of ${images.length} images lack an alt attribute. Empty alt can be valid for decorative images.`},
    {check: 'Canonical link', status: canonicals.length === 1 && !canonicalURLs[0].startsWith('Invalid or unresolved:') ? 'pass' : 'review', detail: `${canonicals.length} canonical link(s). Relative URLs require the optional page URL.`},
    {check: 'HTML language', status: language.trim() ? 'pass' : 'review', detail: language || 'No language declared on the HTML element.'},
    {check: 'Viewport metadata', status: viewport ? 'pass' : 'review', detail: viewport ? 'Viewport metadata is present.' : 'No nonempty viewport meta tag found.'},
    {check: 'Robots indexing directive', status: noindex ? 'review' : 'info', detail: noindex ? 'A noindex or none directive is present; confirm that it is intentional.' : 'No noindex directive found in supplied robots/googlebot meta tags. This does not establish indexability.'},
  ];
  return {title, description, headings, imageCount: images.length, imagesMissingAlt: missingAlt, linkCount: starts.filter(token => token.name === 'a' && 'href' in token.attrs).length, canonicalURLs, robots, checks, scope: 'Structural checks of pasted static HTML only. No URLs are fetched, JavaScript is not rendered, and HTTP headers/robots.txt/rankings/performance are not checked. This is not a full HTML, SEO or accessibility audit.'};
}

export function extendReferenceTools({register, field: f, aliases}) {
  const area = (key, label, value = '') => f(key, label, value, 'textarea');
  const text = (key, label, value = '') => f(key, label, value, 'text');
  const select = (key, label, value, options) => f(key, label, value, 'select', options);
  register('text', 'Text Diff Checker', [area('original', 'Original text', 'First line\nOriginal line\nLast line'), area('revised', 'Revised text', 'First line\nUpdated line\nLast line')], 'Compare exact lines using a bounded longest-common-subsequence algorithm: at most 400 lines and 100,000 characters on each side. Minus marks removals and plus marks additions; line endings are normalized.', values => lineDiff(values.original, values.revised));
  register('random', 'Password Strength Checker', [f('password', 'Password to inspect', '', 'password')], 'Local heuristic based on length, character groups and a small set of obvious patterns. It does not query breaches, estimate cracking time or prove security; the password is not included in the result.', values => passwordStrength(values.password));
  register('developer', 'Text to Binary', [area('text', 'UTF-8 text', 'Hello 🌿')], 'Encode Unicode text as UTF-8 and show each byte as eight binary digits. Supports up to 65,536 bytes; unpaired surrogates are rejected to preserve round trips.', values => textToBinary(values.text));
  register('developer', 'Binary to Text', [area('text', 'UTF-8 binary bytes', '01001000 01100101 01101100 01101100 01101111')], 'Decode complete binary bytes using strict UTF-8. Enter whitespace-separated 8-bit groups or one continuous bit string. Invalid UTF-8 is rejected rather than silently replaced.', values => binaryToText(values.text));
  register('seo', 'Robots.txt Generator', [area('agents', 'User agents, one per line', '*'), area('disallow', 'Disallowed paths, one per line', '/admin/\n/private/'), area('allow', 'Allowed paths, one per line', ''), area('sitemaps', 'Absolute sitemap URLs, one per line', 'https://example.com/sitemap.xml')], 'Generate one robots.txt user-agent group with Allow/Disallow rules and optional Sitemap entries. This guides cooperating crawlers; it does not protect private content or guarantee indexing behavior.', generateRobots, {extension: 'txt'});
  register('seo', 'Sitemap Generator', [area('urls', 'Absolute page URLs, one per line', 'https://example.com/\nhttps://example.com/about'), f('lastmod', 'Actual last modification date (optional)', '', 'date'), select('frequency', 'Change frequency hint', 'not set', ['not set', 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']), f('priority', 'Priority hint (0–1)', 0.5)], 'Create escaped sitemap XML from up to 500 supplied URLs; duplicate normalized URLs are removed. Enter an actual modification date when known. Frequency and priority are optional crawler hints, not ranking controls.', generateSitemap, {extension: 'xml'});
  register('seo', 'Schema Markup Generator', [select('type', 'Schema type', 'Organization', ['Organization', 'Person', 'Article', 'WebSite']), text('name', 'Name / article headline', 'Example Studio'), text('url', 'Canonical URL', 'https://example.com/'), area('description', 'Description', 'Helpful resources from Example Studio.'), text('image', 'Absolute image URL (optional)', ''), text('author', 'Article author name (optional)', '')], 'Generate a small typed JSON-LD object using only supplied facts. Article author is optional. The output is JSON, not an automatic rich-result eligibility check; review the schema against your actual page.', generateSchema, {extension: 'json'});
  register('seo', 'Hreflang Generator', [area('translations', 'Language | absolute URL, one per line', 'en | https://example.com/en/\nhi-IN | https://example.com/hi/\nx-default | https://example.com/')], 'Generate escaped alternate-language link tags for up to 100 language/URL pairs. Include self-references and matching reciprocal tags on each alternate page; this output does not check your live pages.', values => generateHreflang(values.translations), {extension: 'html'});
  register('seo', 'Open Graph Generator', [text('title', 'Title', 'A useful page'), area('description', 'Description', 'A concise description of this page.'), text('url', 'Canonical URL', 'https://example.com/page'), text('image', 'Absolute image URL (optional)', 'https://example.com/cover.jpg'), text('site', 'Site name (optional)', 'Example'), select('type', 'Content type', 'website', ['website', 'article'])], 'Generate escaped Open Graph title, type, URL, description, image and site-name tags from your supplied values. Check image access and test previews on the social platform; no live page is fetched.', generateOpenGraph, {extension: 'html'});
  register('seo', 'Twitter Card Generator', [text('title', 'Title', 'A useful page'), area('description', 'Description', 'A concise description of this page.'), text('image', 'Absolute image URL (optional)', 'https://example.com/cover.jpg'), text('site', 'Site handle (optional)', '@example'), select('card', 'Card type', 'summary_large_image', ['summary', 'summary_large_image'])], 'Generate escaped Twitter/X summary card metadata. Supply a real public image URL and valid site handle when available. The platform decides how a shared link is displayed; previews are not fetched here.', generateTwitterCard, {extension: 'html'});
  register('seo', 'SERP Preview', [text('title', 'Page title', 'Helpful online tools | Example'), area('description', 'Meta description', 'Explore practical online tools for everyday tasks.'), text('url', 'Page URL', 'https://example.com/tools')], 'Prepare a text-only search-result preview and Unicode character counts from supplied metadata. Search engines may rewrite or truncate results; this does not query rankings, search engines or live page content.', serpPreview);
  register('seo', 'On-Page SEO Checker', [area('html', 'Paste static HTML source', '<!doctype html>\n<html lang="en"><head><title>Example page</title><meta name="description" content="A helpful example page."><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/"></head><body><h1>Welcome</h1><img src="cover.jpg" alt="A green landscape"></body></html>'), text('url', 'Page URL for relative canonical links (optional)', 'https://example.com/')], 'Inspect up to 200,000 characters and 5,000 tags of pasted static HTML for titles, descriptions, headings, image alt attributes, canonical links and robots metadata. No network requests or JavaScript rendering; malformed HTML and full SEO/accessibility conformance require other checks.', values => analyzeHTMLSEO(values.html, values.url));
  Object.assign(aliases, {'code-difference-comparison-tool': 'text-diff-checker', 'code-difference-tool': 'text-diff-checker', 'diff-checker': 'text-diff-checker', 'utf8-text-to-binary': 'text-to-binary', 'binary-to-utf8-text': 'binary-to-text', 'serp-checker': 'serp-preview', 'google-serp-preview-tool': 'serp-preview', 'free-serp-preview-tool': 'serp-preview', 'x-card-generator': 'twitter-card-generator'});
}
