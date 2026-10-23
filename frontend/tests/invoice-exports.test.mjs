import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { calculateInvoice, processReferenceBrowser } from '../src/lib/reference-browser.mjs';
import { invoiceHTML, invoiceCSV, exportInvoice } from '../src/lib/invoice-exports.mjs';

const values = (exportFormat, extra = {}) => ({ invoiceNumber: 'INV/TEST', business: 'Studio\n123 Road', customer: 'Client', currency: 'INR', issueDate: '2026-01-01', dueDate: '2026-01-31', items: 'description,quantity,rate\nDesign,2,125.00\nConsulting,1.5,80.00', discount: '20', tax: '10', notes: 'Thank you', exportFormat, ...extra });
const run = (format, extra) => processReferenceBrowser({ mode: 'invoice' }, values(format, extra));

test('invoice HTML preserves Unicode and escapes untrusted text and attributes', async () => {
  const result = await run('HTML', { business: '<script>alert(1)</script> café हिन्दी', notes: '<img src=x onerror=alert(1)>' });
  const html = await result.blob.text();
  assert.match(result.filename, /^invoice-INV-TEST\.html$/);
  assert.match(html, /café हिन्दी/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /385\.00/);
  assert.match(html, /default-src 'none'/);
  assert.equal(result.htmlPreview, html);
});

test('invoice CSV protects formula-like metadata and retains quoted text and numeric values', async () => {
  const result = await run('CSV', { invoiceNumber: '=HYPERLINK("bad")', business: '\t+SUM(A1)', customer: '@bad', items: '"Design, print and ""proof""",1,0.05', discount: '0', tax: '10' });
  const csv = await result.blob.text();
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"'\+SUM\(A1\)"/);
  assert.match(csv, /"'@bad"/);
  assert.match(csv, /"Design, print and ""proof"""/);
  assert.match(csv, /"TOTAL","","","0\.06"/);
  assert.match(result.warning, /apostrophe/);
});

test('invoice XLSX contains styled typed numeric cells and inert inline strings', async () => {
  const result = await run('Excel (XLSX)', { customer: '=SUM(A1:A5) हिन्दी', notes: '<&>' });
  assert.equal(result.blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=SUM\(A1:A5\) हिन्दी/);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(sheet, /<c r="D16" s="1"><v>385<\/v>/);
  assert.match(sheet, /&lt;&amp;&gt;/);
  assert.match(await zip.file('xl/styles.xml').async('string'), /numFmtId="2"/);
  for (const file of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels']) assert.ok(zip.file(file));
});

test('JSON export keeps exact integer cents, details and line items', async () => {
  const result = await run('JSON');
  assert.deepEqual(JSON.parse(await result.blob.text()), calculateInvoice(values('JSON')));
  assert.match(result.text, /TOTAL: INR 385.00/);
});

test('all invoice formats share validation and reject unknown formats', async () => {
  for (const format of ['HTML', 'Excel (XLSX)', 'CSV', 'JSON', 'PNG photo', 'All formats (ZIP)']) await assert.rejects(() => run(format, { discount: '999999' }), /Discount cannot exceed/);
  await assert.rejects(() => run('unsupported'), /supported invoice export format/);
  await assert.rejects(() => run('PNG photo'), /requires a browser/);
});

test('all-formats export creates one archive with every format and photo page', async () => {
  const previousDocument = globalThis.document;
  // A canvas adapter checks archive assembly in Node; browser rendering needs separate visual verification.
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) }), toBlob: (callback, type) => callback(new Blob(['photo'], { type })) }) };
  try {
    const data = calculateInvoice(values('All formats (ZIP)'));
    const result = await exportInvoice(data, 'All formats (ZIP)', async () => ({ blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }), text: 'PDF' }));
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    for (const name of ['invoice-INV-TEST.pdf', 'invoice-INV-TEST.html', 'invoice-INV-TEST.xlsx', 'invoice-INV-TEST.csv', 'invoice-INV-TEST.json', 'invoice-INV-TEST-page-1.png', 'invoice-INV-TEST-page-1.jpg', 'README.txt']) assert.ok(zip.file(name), name);
    assert.equal(JSON.parse(await zip.file('invoice-INV-TEST.json').async('string')).totalCents, 38500);
    const single = await run('PNG photo'); assert.equal(single.preview, true); assert.equal(single.blob.type, 'image/png');
    const many = await run('JPEG photo', { items: Array.from({ length: 100 }, (_, i) => `Item ${i},1,1`).join('\n'), discount: '0' });
    assert.match(many.filename, /\.zip$/); assert.match(many.warning, /photo pages/);
    const photos = await JSZip.loadAsync(await many.blob.arrayBuffer()); assert.ok(Object.keys(photos.files).length > 1);
  } finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});

test('standalone serializers do not mutate calculated invoice data', () => {
  const data = calculateInvoice(values('CSV')), original = structuredClone(data);
  invoiceHTML(data); invoiceCSV(data); assert.deepEqual(data, original);
});
