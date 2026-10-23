// Run manually with a local frontend at http://127.0.0.1:3000.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import JSZip from 'jszip';
import { processReferenceBrowser } from '../src/lib/reference-browser.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [], failedRequests = [], ocrRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => { if (/tesseract|traineddata/i.test(response.url())) ocrRequests.push({ url: response.url(), status: response.status() }); });
const downloadBytes = async () => {
  const link = page.getByRole('link', { name: /^Download/ }).last();
  await link.waitFor({ timeout: 120000 });
  return Buffer.from(await link.evaluate(async anchor => Array.from(new Uint8Array(await (await fetch(anchor.href)).arrayBuffer()))));
};
try {
  await page.goto('http://127.0.0.1:3000/tools/invoice-generator', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByLabel('Download format').selectOption('All formats (ZIP)');
  await page.locator('.tool-form button[type=submit], .tool-form button:not([type])').first().click();
  const zip = await JSZip.loadAsync(await downloadBytes());
  const names = Object.keys(zip.files);
  for (const ext of ['pdf', 'html', 'xlsx', 'csv', 'json', 'png', 'jpg']) assert.ok(names.some(name => name.endsWith(`.${ext}`)), ext);
  console.log('Generator browser ZIP OK:', names.join(', '));

  const pdf = await processReferenceBrowser({ mode: 'invoice' }, { invoiceNumber: 'E2E-SYNTHETIC', business: 'Browser Test Studio', customer: 'Synthetic Customer', currency: 'USD', issueDate: '2026-01-01', dueDate: '2026-01-31', items: 'Synthetic Widget,2,10.00', discount: '0', tax: '0', notes: 'SYNTHETIC INVOICE FOR TESTING' });
  await page.goto('http://127.0.0.1:3000/tools/invoice-converter', { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.blob.arrayBuffer()) });
  await page.getByRole('button', { name: 'Extract invoice text' }).click();
  await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('Synthetic Widget'), null, { timeout: 120000 });
  const text = await page.locator('textarea').inputValue(); assert.match(text, /20\.00/); assert.match(text, /E2E-SYNTHETIC/);
  await page.getByLabel('Output format').selectOption('Excel (XLSX)'); await page.getByRole('button', { name: 'Convert reviewed text' }).click();
  const workbook = await JSZip.loadAsync(await downloadBytes()); assert.match(await workbook.file('xl/worksheets/sheet1.xml').async('string'), /Synthetic Widget/);
  console.log('Selectable PDF extraction + browser XLSX OK:', text.replaceAll('\n', ' | ').slice(0, 400));

  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 650;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1200, 650); ctx.fillStyle = '#000'; ctx.font = '44px Arial';
    ['INVOICE E2E 123', 'SYNTHETIC TEST COMPANY', 'Widget Quantity 2 Rate 10.00', 'TOTAL USD 20.00', 'Thank you'].forEach((line, i) => ctx.fillText(line, 65, 90 + i * 105));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-invoice.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
  await page.getByRole('button', { name: 'Extract invoice text' }).click();
  await page.waitForFunction(() => Boolean(document.querySelector('textarea')?.value.trim()) || [...document.querySelectorAll('[role=alert]')].some(node => node.textContent.trim()), null, { timeout: 180000 });
  const ocrError = (await page.getByRole('alert').allTextContents()).filter(value => value.trim()); if (ocrError.length) throw Error(ocrError.join('\n'));
  const recognized = await page.locator('textarea').inputValue(); assert.match(recognized, /INVOICE/i); assert.match(recognized, /20\.00/);
  console.log('Photo OCR browser OK:', recognized.replaceAll('\n', ' | ')); console.log('OCR network:', JSON.stringify(ocrRequests));
  assert.equal(errors.length, 0, errors.join('\n')); console.log('Browser page errors:', errors); console.log('Failed requests:', failedRequests);
} catch (error) { console.log('Failure diagnostics:', JSON.stringify({ error: error.message, errors, failedRequests, ocrRequests, status: await page.getByRole('status').allTextContents().catch(() => []) })); throw error; }
finally { await browser.close(); }
