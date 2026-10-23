import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { convertReviewedInvoice, extractInvoice, extractedHTML, extractedCSV, reviewedInvoiceText, validateInvoiceSource } from '../src/lib/invoice-import.mjs';

const raw = 'Invoice INV-123\nClient: Café हिन्दी\nWidget 2 x 10.00\nTotal 20.00\n\nThank you';
test('invoice import validates sources before expensive PDF or OCR work', async () => {
  for (const file of [null, { type: 'text/html', size: 10 }, { type: 'application/pdf', size: 0 }, { type: 'image/png', size: 21 * 1024 * 1024 }]) assert.throws(() => validateInvoiceSource(file));
  const file = { type: 'application/pdf', size: 10 };
  assert.equal(validateInvoiceSource(file), file);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => extractInvoice(file, { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(() => extractInvoice(file, { language: 'unknown' }), /supported OCR language/);
});
test('reviewed text keeps original lines, Unicode and blanks without inventing numbers', async () => {
  assert.equal(reviewedInvoiceText(' A\r\n\r\nB '), ' A\n\nB ');
  for (const invalid of ['', '   ', 'x'.repeat(100001), 'a\u0000b']) assert.throws(() => reviewedInvoiceText(invalid));
  const txt = await convertReviewedInvoice(raw, 'TXT'); assert.equal(await txt.blob.text(), raw);
  const json = await convertReviewedInvoice(raw, 'JSON'), value = JSON.parse(await json.blob.text());
  assert.equal(value.text, raw); assert.equal(value.kind, 'reviewed-extracted-text'); assert.ok(!('totalCents' in value));
});
test('import HTML escapes hostile content and CSV neutralizes formulas without financial inference', async () => {
  const html = extractedHTML(raw + '\n<script>alert(1)</script>');
  assert.match(html, /Café हिन्दी/); assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
  const csv = extractedCSV('Total, "20"\n=HYPERLINK("bad")\n\t+SUM(A1)\n@formula\n-2');
  assert.match(csv, /"Total, ""20"""/); assert.match(csv, /"'=HYPERLINK/); assert.match(csv, /"'\t\+SUM/); assert.match(csv, /"'@formula"/); assert.match(csv, /"'-2"/);
  const result = await convertReviewedInvoice(raw, 'HTML'); assert.equal(await result.blob.text(), extractedHTML(raw));
});
test('reviewed invoice workbook stores inert literal lines and positions', async () => {
  const result = await convertReviewedInvoice(raw + '\n=SUM(A1)', 'Excel (XLSX)');
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /Café हिन्दी/); assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=SUM\(A1\)/); assert.doesNotMatch(sheet, /<f[ >]/); assert.match(sheet, /Total 20\.00/);
  assert.match(sheet, /Y position/);
});
test('reviewed text exports reject unknown formats and pre-cancelled work', async () => {
  await assert.rejects(() => convertReviewedInvoice(raw, 'unknown'), /supported output format/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(() => convertReviewedInvoice(raw, 'TXT', { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(() => convertReviewedInvoice(raw, 'PNG photo'), /requires a browser/);
});
test('reviewed invoice all-format archive has real image-based PDF and expected downloads', async () => {
  const previous = globalThis.document;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNgAAAABJRU5ErkJggg==', 'base64');
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) }), toBlob: (callback, type) => callback(new Blob([png], { type })) }) };
  try {
    const result = await convertReviewedInvoice(raw, 'All formats (ZIP)');
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    for (const name of ['reviewed-invoice.txt', 'reviewed-invoice.html', 'reviewed-invoice.csv', 'reviewed-invoice.json', 'reviewed-invoice.xlsx', 'reviewed-invoice.pdf', 'reviewed-invoice-page-1.png', 'reviewed-invoice-page-1.jpg', 'README.txt']) assert.ok(zip.file(name));
    assert.equal(await zip.file('reviewed-invoice.txt').async('string'), raw);
    const pdf = await PDFDocument.load(await zip.file('reviewed-invoice.pdf').async('uint8array')); assert.equal(pdf.getPageCount(), 1);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
