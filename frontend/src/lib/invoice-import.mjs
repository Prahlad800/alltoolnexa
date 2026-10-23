import { escapeHTML } from '../../shared/core.mjs';
import { checkImage } from './file-input.mjs';
import { loadPDF, renderPage, pdfTextRows, rowsText, rowsWorkbook } from './reference-files.mjs';
import { closePDF } from './pdf-lifecycle.mjs';

export const IMPORT_FORMATS = ['HTML', 'Excel (XLSX)', 'CSV', 'TXT', 'JSON', 'PDF', 'PNG photo', 'JPEG photo', 'All formats (ZIP)'];
export const IMPORT_NOTE = 'Reviewed extracted text only. Original layout, financial columns and formulas are not reconstructed. Check every amount and OCR word before sharing.';
export function validateInvoiceSource(file) {
  if (!file) throw Error('Choose an invoice PDF or photo.');
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a PDF, PNG, JPEG or still WebP file.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw Error('Choose a nonempty file up to 20 MB.');
  return file;
}
export function reviewedInvoiceText(text) {
  text = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!text.trim()) throw Error('No readable text yet. Extract text or type the invoice text to convert.');
  if (text.length > 100000) throw Error('Keep reviewed text below 100,000 characters.');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw Error('Reviewed text contains unsupported control characters.');
  return text;
}
function abortable(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Cancelled.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function extractInvoice(file, { password = '', useOCR = false, language = 'eng', signal, onProgress = () => {} } = {}) {
  validateInvoiceSource(file); signal?.throwIfAborted();
  if (!['eng', 'hin', 'eng+hin'].includes(language)) throw Error('Choose a supported OCR language.');
  let worker, pdf;
  const stopOCR = () => { void worker?.terminate().catch(() => {}); };
  signal?.addEventListener('abort', stopOCR, { once: true });
  const recognize = async image => {
    signal?.throwIfAborted();
    try {
      if (!worker) {
        onProgress('Loading OCR engine and language model…');
        const { createWorker } = await import('tesseract.js');
        signal?.throwIfAborted();
        const initializing = createWorker(language, 1, { logger: event => {
          if (!signal?.aborted) onProgress(`${event.status || 'OCR'}${Number.isFinite(event.progress) ? ` ${Math.round(event.progress * 100)}%` : ''}`);
        } });
        initializing.then(created => { if (signal?.aborted) void created.terminate().catch(() => {}); }).catch(() => {});
        worker = await abortable(initializing, signal);
      }
      const result = await abortable(worker.recognize(image), signal);
      return result.data.text || '';
    } catch (error) {
      signal?.throwIfAborted();
      throw Error(`OCR could not finish. Check the connection for the language-model download, try a clearer photo, or type/paste the invoice text below. ${error.message}`);
    }
  };
  try {
    if (file.type !== 'application/pdf') {
      await checkImage(file); signal?.throwIfAborted();
      const text = await recognize(file);
      if (!text.trim()) throw Error('No words were detected. Try a sharper photo or type/paste the text below.');
      return { text: reviewedInvoiceText(text), pages: 1, method: 'Photo OCR', warning: IMPORT_NOTE };
    }
    pdf = await loadPDF(file, password, signal);
    if (pdf.numPages > 10) throw Error('Use a PDF with at most 10 pages. Split a larger PDF first.');
    const pages = [], missing = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      signal?.throwIfAborted(); onProgress(`Reading page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      let canvas;
      try {
        const content = await page.getTextContent(); signal?.throwIfAborted();
        let text = rowsText(pdfTextRows(content.items));
        if (!text.trim() && useOCR) {
          canvas = await renderPage(page, 1.7, signal); text = await recognize(canvas);
        }
        if (!text.trim()) missing.push(i);
        pages.push(text);
        if (pages.reduce((n, value) => n + value.length, 0) > 100000) throw Error('Extracted text exceeds 100,000 characters. Split this invoice into smaller files.');
      } finally { if (canvas) { canvas.width = 1; canvas.height = 1; } page.cleanup(); }
    }
    if (!pages.some(text => text.trim())) throw Error('This PDF has no selectable text. Enable OCR for scanned pages, or type/paste the invoice text below.');
    return { text: reviewedInvoiceText(pages.join('\n\n')), pages: pdf.numPages, method: useOCR ? 'PDF text with OCR on empty pages' : 'PDF selectable text', warning: `${IMPORT_NOTE}${missing.length ? ` Pages ${missing.join(', ')} had no readable text and are omitted; enable OCR or transcribe them before exporting.` : ''}` };
  } finally {
    signal?.removeEventListener('abort', stopOCR);
    await worker?.terminate().catch(() => {}); await closePDF(pdf);
  }
}

export function extractedHTML(text) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Reviewed invoice text</title><style>body{font:16px/1.6 Arial,sans-serif;max-width:900px;margin:32px auto;padding:20px;color:#182d24}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}small{color:#526458}</style></head><body><h1>Reviewed invoice text</h1><pre>${escapeHTML(reviewedInvoiceText(text))}</pre><p><small>${IMPORT_NOTE}</small></p></body></html>`;
}
export function extractedCSV(text) {
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  return '\uFEFF"Line","Extracted text"\r\n' + reviewedInvoiceText(text).split('\n').map((line, i) => {
    const safe = /^[\s\uFEFF]*[=+@-]/u.test(line) ? "'" + line : line;
    return `${i + 1},${quote(safe)}`;
  }).join('\r\n');
}

async function textPhotos(text, type, signal) {
  if (typeof document === 'undefined') throw Error('PDF/photo export requires a browser.');
  signal?.throwIfAborted(); await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas is unavailable.');
  const blobs = []; let y;
  const reset = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1240, 1754); ctx.fillStyle = '#182d24'; ctx.font = '24px Arial,sans-serif'; ctx.textBaseline = 'top'; y = 70; };
  const save = async () => {
    signal?.throwIfAborted();
    if (blobs.length >= 25) throw Error('Photo/PDF output exceeds 25 pages. Shorten the reviewed text or choose TXT, CSV or Excel.');
    ctx.font = '18px Arial,sans-serif'; ctx.fillStyle = '#526458'; ctx.fillText(`Reviewed invoice text · Page ${blobs.length + 1}`, 70, 1680);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .93));
    if (!blob) throw Error('Could not encode the reviewed invoice page.');
    blobs.push(blob); reset();
  };
  const line = async value => { signal?.throwIfAborted(); if (y > 1600) await save(); ctx.fillText(value, 70, y); y += 32; };
  try {
    reset();
    for (const paragraph of text.split('\n')) {
      let pending = '';
      for (const char of paragraph) {
        if (pending && ctx.measureText(pending + char).width > 1100) { await line(pending); pending = ''; }
        pending += char;
      }
      await line(pending);
    }
    await save(); return blobs;
  } finally { canvas.width = 1; canvas.height = 1; }
}
async function zipFiles(files) {
  const { default: JSZip } = await import('jszip'), zip = new JSZip();
  for (const [name, value] of files) zip.file(name, value instanceof Blob ? await value.arrayBuffer() : value);
  return new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })], { type: 'application/zip' });
}
export async function convertReviewedInvoice(raw, format, { signal } = {}) {
  const text = reviewedInvoiceText(raw); signal?.throwIfAborted();
  if (!IMPORT_FORMATS.includes(format)) throw Error('Choose a supported output format.');
  const result = (blob, ext, preview = false) => ({ blob, filename: `reviewed-invoice.${ext}`, preview });
  const workbook = () => rowsWorkbook([{ page: 1, rows: text.split('\n').map((value, i) => ({ y: i + 1, items: [{ x: 0, text: value }] })) }]);
  const json = () => JSON.stringify({ kind: 'reviewed-extracted-text', note: IMPORT_NOTE, text }, null, 2);
  const photoFiles = async (type, ext) => (await textPhotos(text, type, signal)).map((blob, i) => [`reviewed-invoice-page-${i + 1}.${ext}`, blob]);
  const pdfFile = async () => {
    const { PDFDocument } = await import('pdf-lib'), pdf = await PDFDocument.create();
    for (const blob of await textPhotos(text, 'image/png', signal)) {
      signal?.throwIfAborted();
      const image = await pdf.embedPng(await blob.arrayBuffer()), page = pdf.addPage([595.28, 841.89]);
      page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    }
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  };
  switch (format) {
    case 'TXT': return result(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'txt');
    case 'HTML': return result(new Blob([extractedHTML(text)], { type: 'text/html;charset=utf-8' }), 'html');
    case 'CSV': return result(new Blob([extractedCSV(text)], { type: 'text/csv;charset=utf-8' }), 'csv');
    case 'JSON': return result(new Blob([json()], { type: 'application/json' }), 'json');
    case 'Excel (XLSX)': return result(await workbook(), 'xlsx');
    case 'PDF': return result(await pdfFile(), 'pdf');
    case 'PNG photo': case 'JPEG photo': {
      const ext = format === 'PNG photo' ? 'png' : 'jpg', files = await photoFiles(ext === 'png' ? 'image/png' : 'image/jpeg', ext);
      return files.length === 1 ? result(files[0][1], ext, true) : { ...result(await zipFiles(files), 'zip'), warning: `${files.length} photo pages included in ZIP.` };
    }
    default: {
      const files = [['reviewed-invoice.txt', text], ['reviewed-invoice.html', extractedHTML(text)], ['reviewed-invoice.csv', extractedCSV(text)], ['reviewed-invoice.json', json()], ['reviewed-invoice.xlsx', await workbook()], ['reviewed-invoice.pdf', await pdfFile()], ...await photoFiles('image/png', 'png'), ...await photoFiles('image/jpeg', 'jpg'), ['README.txt', `${IMPORT_NOTE}\nExcel columns contain line number (Y position), a zero X placeholder and literal text, not financial table fields. CSV formula-like lines are prefixed with an apostrophe. PDF is image based, using installed browser fonts; text is not selectable.`]];
      signal?.throwIfAborted(); return result(await zipFiles(files), 'zip');
    }
  }
}
