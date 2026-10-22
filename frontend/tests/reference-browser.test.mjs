import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { calculateInvoice, parseInvoiceCSV, safePDFText, browserFacts, formatXML, processReferenceBrowser } from '../src/lib/reference-browser.mjs';

const invoice = (extra = {}) => ({
  invoiceNumber: 'INV-TEST', business: 'Studio\n123 Street', customer: 'Client',
  currency: 'USD', issueDate: '2026-01-01', dueDate: '2026-01-31',
  items: 'description,quantity,rate\nDesign,2,125.00\nConsultation,1.5,80.00',
  discount: '20.00', tax: '10', notes: '', ...extra,
});

test('invoice totals apply fixed discount before tax using exact cents', () => {
  const result = calculateInvoice(invoice());
  assert.deepEqual([result.subtotalCents, result.discountCents, result.taxableCents, result.taxCents, result.totalCents], [37000, 2000, 35000, 3500, 38500]);
  const pennies = calculateInvoice(invoice({ items: 'Fraction,0.5,0.01\nSecond,1,0.10', discount: '0', tax: '10' }));
  assert.equal(pennies.items[0].amountCents, 1);
  assert.deepEqual([pennies.subtotalCents, pennies.taxCents, pennies.totalCents], [11, 1, 12]);
  assert.equal(calculateInvoice(invoice({ items: 'Item,1,0.05', discount: '0', tax: '10' })).taxCents, 1);
  assert.equal(calculateInvoice(invoice({ discount: '370', tax: '100' })).totalCents, 0);
});

test('invoice CSV handles quoted descriptions without swallowing malformed rows', () => {
  assert.equal(parseInvoiceCSV('description,quantity,rate\n"Design, print and \"\"proof\"\"",2,15.25')[0].description, 'Design, print and "proof"');
  assert.equal(parseInvoiceCSV('"Two\nlines",1,0')[0].description, 'Two lines');
  for (const input of ['Item,1', 'Item,1,2,3', '"Unclosed,1,2', '"Closed"oops,1,2', 'Un"quoted,1,2', 'description,quantity,rate']) assert.throws(() => parseInvoiceCSV(input));
});

test('invoice rejects invalid dates, excessive discount and unsafe numeric inputs', () => {
  for (const extra of [
    { items: 'Item,0,2' }, { items: 'Item,-1,2' }, { items: 'Item,1,-2' },
    { items: 'Item,1,NaN' }, { items: 'Item,1e3,2' }, { items: 'Item,1,1.001' },
    { items: 'Item,0.0000001,2' }, { discount: '-1' }, { discount: '371' },
    { tax: '100.0001' }, { tax: '10.12345' }, { currency: '' },
    { issueDate: '2026-02-30' }, { dueDate: '2025-12-31' }, { business: '' },
    { items: 'Item,1000000,10000000000' },
  ]) assert.throws(() => calculateInvoice(invoice(extra)));
});

test('invoice produces a real PDF with safe text and readable pagination', async () => {
  const result = await processReferenceBrowser({ mode: 'invoice' }, invoice({
    business: 'Café 東京 ₹', notes: 'Line\n'.repeat(300),
    items: Array.from({ length: 80 }, (_, i) => `Design work ${i + 1},1,0.10`).join('\n'),
    discount: '0', tax: '0',
  }));
  assert.equal(result.blob.type, 'application/pdf');
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.ok(pdf.getPageCount() > 1);
  assert.equal(result.filename, 'invoice-INV-TEST.pdf');
  assert.match(result.text, /Total: USD 8.00/);
  assert.match(result.text, /basic Latin/);
  assert.equal(safePDFText('Café — ₹100 東京'), 'Cafe - INR 100 ??');
});

test('browser facts report provided navigator data without guessing browser identity', () => {
  const facts = browserFacts({ userAgent: 'custom-agent', language: 'en-IN', languages: ['en-IN'], platform: 'reduced', hardwareConcurrency: 4 });
  assert.equal(facts.userAgent, 'custom-agent');
  assert.equal(facts.legacyPlatform, 'reduced');
  assert.equal(facts.logicalProcessors, 4);
  assert.equal(facts.userAgentClientHints, 'Not exposed');
  assert.ok(!('browserName' in facts));
});

test('XML rejects malformed markup and preserves mixed content', { skip: typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined' }, () => {
  assert.throws(() => formatXML('<root><broken></root>'), /Malformed/);
  assert.throws(() => formatXML('<!DOCTYPE root><root/>'), /DTD/);
  assert.match(formatXML('<root><item>one</item><item>two</item></root>'), /\n  <item>one<\/item>/);
  assert.equal(formatXML('<p>Hello <b>useful</b> world.</p>'), '<p>Hello <b>useful</b> world.</p>');
  assert.equal(formatXML('<p xml:space="preserve"><b>one</b> <b>two</b></p>'), '<p xml:space="preserve"><b>one</b> <b>two</b></p>');
});

test('SQL formatting uses dialect parser and reports malformed token input', async () => {
  const result = await processReferenceBrowser({ mode: 'sql' }, { text: 'select id,email from users where id=1;', language: 'sql' });
  assert.match(result.text, /SELECT\n/);
  assert.match(result.text, /FROM\n/);
  await assert.rejects(() => processReferenceBrowser({ mode: 'sql' }, { text: "select 'unclosed", language: 'sql' }));
});
