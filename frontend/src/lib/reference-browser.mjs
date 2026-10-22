import { date, integer } from '../../../shared/core.mjs';

const MAX_INVOICE_CENTS = 1_000_000_000_000n;
const limitedText = (value, label, max, required = false) => {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (required && !text) throw Error(`${label} is required.`);
  if (text.length > max) throw Error(`${label} must be at most ${max} characters.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw Error(`${label} contains unsupported control characters.`);
  return text;
};
const inputText = (value, label = 'Input') => limitedText(value, label, 2_000_000, true);

// Integer decimal arithmetic avoids binary floating-point errors in invoice totals.
function decimalUnits(value, places, label, max) {
  const text = String(value ?? '').trim();
  const match = new RegExp(`^\\+?(\\d+)(?:\\.(\\d{1,${places}}))?$`).exec(text);
  if (!match) throw Error(`${label} must be a nonnegative decimal with at most ${places} decimal places.`);
  if (text.length > 30) throw Error(`${label} is too large.`);
  const units = BigInt(match[1]) * (10n ** BigInt(places)) + BigInt((match[2] || '').padEnd(places, '0'));
  if (units > max) throw Error(`${label} is too large.`);
  return units;
}
const halfUp = (numerator, denominator) => (numerator + denominator / 2n) / denominator;

// A strict CSV reader: quoted commas, escaped quotes and quoted newlines work;
// stray quotes and characters following a closing quote are rejected.
export function parseInvoiceCSV(value) {
  const text = limitedText(value, 'Line items', 100_000, true).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', state = 'start';
  const finishCell = () => { row.push(cell); cell = ''; state = 'start'; };
  const finishRow = () => { finishCell(); if (row.some(part => part.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === 'quoted') {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') state = 'closed';
      else cell += c;
    } else if (c === ',') finishCell();
    else if (c === '\n') finishRow();
    else if (state === 'closed') {
      if (c !== ' ' && c !== '\t') throw Error('CSV has characters after a closing quote.');
    } else if (c === '"') {
      if (state !== 'start') throw Error('CSV quotes must surround the entire field.');
      state = 'quoted';
    } else { cell += c; state = 'plain'; }
  }
  if (state === 'quoted') throw Error('CSV contains an unclosed quote.');
  finishRow();
  if (rows[0]?.map(cell => cell.trim().toLowerCase()).join(',') === 'description,quantity,rate') rows.shift();
  if (!rows.length || rows.length > 100) throw Error('Enter 1 to 100 invoice line items.');
  return rows.map((cells, index) => {
    const label = `Line ${index + 1}`;
    if (cells.length !== 3) throw Error(`${label} must have exactly description, quantity and rate.`);
    const description = limitedText(cells[0], `${label} description`, 500, true).replace(/\s+/g, ' ');
    const quantityUnits = decimalUnits(cells[1], 6, `${label} quantity`, 1_000_000_000_000n);
    if (quantityUnits === 0n) throw Error(`${label} quantity must be greater than zero.`);
    const rateCents = decimalUnits(cells[2], 2, `${label} rate`, MAX_INVOICE_CENTS);
    const amountCents = halfUp(quantityUnits * rateCents, 1_000_000n);
    if (amountCents > MAX_INVOICE_CENTS) throw Error(`${label} amount is too large.`);
    const fraction = String(quantityUnits % 1_000_000n).padStart(6, '0').replace(/0+$/, '');
    const quantity = `${quantityUnits / 1_000_000n}${fraction ? `.${fraction}` : ''}`;
    return { description, quantity, rateCents: Number(rateCents), amountCents: Number(amountCents) };
  });
}

export function calculateInvoice(values) {
  const invoiceNumber = limitedText(values.invoiceNumber, 'Invoice number', 80, true);
  const business = limitedText(values.business, 'Business details', 1000, true);
  const customer = limitedText(values.customer, 'Customer details', 1000, true);
  const currency = limitedText(values.currency, 'Currency label', 12, true);
  if (currency.includes('\n')) throw Error('Currency label must be on one line.');
  const issueDate = String(values.issueDate ?? ''), dueDate = String(values.dueDate ?? '');
  date(issueDate); date(dueDate);
  if (dueDate < issueDate) throw Error('Due date must be on or after the invoice date.');
  const items = parseInvoiceCSV(values.items);
  const subtotal = items.reduce((total, item) => total + BigInt(item.amountCents), 0n);
  if (subtotal > MAX_INVOICE_CENTS) throw Error('Invoice subtotal is too large.');
  const discount = decimalUnits(values.discount, 2, 'Discount', MAX_INVOICE_CENTS);
  if (discount > subtotal) throw Error('Discount cannot exceed the subtotal.');
  const taxRateUnits = decimalUnits(values.tax, 4, 'Tax rate', 1_000_000n);
  const taxable = subtotal - discount;
  const tax = halfUp(taxable * taxRateUnits, 1_000_000n);
  const total = taxable + tax;
  if (total > MAX_INVOICE_CENTS) throw Error('Invoice total is too large.');
  return {
    invoiceNumber, business, customer, currency, issueDate, dueDate, items,
    notes: limitedText(values.notes, 'Notes', 2000), taxRate: String(values.tax).trim(),
    subtotalCents: Number(subtotal), discountCents: Number(discount),
    taxableCents: Number(taxable), taxCents: Number(tax), totalCents: Number(total),
  };
}

export function safePDFText(value) {
  const replacements = { '₹': 'INR ', '€': 'EUR ', '£': 'GBP ', '¥': 'JPY ', '—': '-', '–': '-', '−': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '×': 'x', '\u00a0': ' ' };
  return String(value).replace(/[₹€£¥—–−“”‘’…×\u00a0]/g, c => replacements[c])
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e\n]/g, '?');
}
const money = (cents, currency) => `${currency} ${(cents / 100).toFixed(2)}`;

async function invoicePDF(values) {
  const data = calculateInvoice(values);
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Invoice ${safePDFText(data.invoiceNumber)}`);
  pdf.setCreator('AllToolNexa');
  const margin = 44, pageWidth = 595.28, pageHeight = 841.89, contentWidth = pageWidth - margin * 2;
  const ink = rgb(.1, .16, .13), muted = rgb(.35, .39, .37), green = rgb(.14, .36, .27);
  let page, y;
  const newPage = () => { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; };
  newPage();
  const ensure = height => { if (y - height < 52) { newPage(); return true; } return false; };
  const draw = (value, x, at, size = 10, font = regular, color = ink) => page.drawText(safePDFText(value), { x, y: at, size, font, color });
  const wrap = (value, width, size = 10, font = regular) => {
    const lines = [];
    for (const paragraph of safePDFText(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        let remaining = word;
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { lines.push(line); line = ''; }
        while (font.widthOfTextAtSize(remaining, size) > width) {
          let end = 1;
          while (end < remaining.length && font.widthOfTextAtSize(remaining.slice(0, end + 1), size) <= width) end++;
          if (line) { lines.push(line); line = ''; }
          lines.push(remaining.slice(0, end)); remaining = remaining.slice(end);
        }
        if (remaining) line = line ? `${line} ${remaining}` : remaining;
      }
      lines.push(line);
    }
    return lines;
  };
  const paragraph = (value, { size = 10, font = regular, color = ink, gap = 7 } = {}) => {
    for (const line of wrap(value, contentWidth, size, font)) { ensure(size + 5); draw(line, margin, y, size, font, color); y -= size + 5; }
    y -= gap;
  };
  paragraph('INVOICE', { size: 24, font: bold, color: green, gap: 8 });
  paragraph(`Invoice: ${data.invoiceNumber}\nIssued: ${data.issueDate}     Due: ${data.dueDate}\nCurrency: ${data.currency}`, { color: muted });
  paragraph('FROM', { size: 9, font: bold, color: green, gap: 0 }); paragraph(data.business);
  paragraph('BILL TO', { size: 9, font: bold, color: green, gap: 0 }); paragraph(data.customer);
  const columns = [margin, margin + 304, margin + 355, margin + 438];
  const tableHeader = () => {
    ensure(26);
    page.drawRectangle({ x: margin - 5, y: y - 7, width: contentWidth + 10, height: 24, color: rgb(.92, .95, .93) });
    ['Description', 'Qty', 'Rate', 'Amount'].forEach((label, i) => draw(label, columns[i], y, 9, bold)); y -= 28;
  };
  tableHeader();
  for (const item of data.items) {
    const lines = wrap(item.description, 288, 9), height = Math.max(lines.length * 13, 16) + 9;
    if (ensure(height)) tableHeader();
    lines.forEach((line, i) => draw(line, columns[0], y - i * 13, 9));
    // Numeric cells use a fitted font so large valid amounts never overlap.
    [item.quantity, (item.rateCents / 100).toFixed(2), (item.amountCents / 100).toFixed(2)].forEach((value, i) => {
      const width = [43, 74, 69][i], text = safePDFText(value);
      const size = Math.min(9, width * 9 / regular.widthOfTextAtSize(text, 9));
      draw(text, columns[i + 1], y, size);
    });
    y -= height;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: .4, color: rgb(.83, .87, .84) });
  }
  y -= 12; ensure(115);
  const summary = [
    ['Subtotal', data.subtotalCents], ['Discount', -data.discountCents],
    ['Taxable subtotal', data.taxableCents], [`Tax (${data.taxRate}%)`, data.taxCents], ['TOTAL', data.totalCents],
  ];
  for (const [label, cents] of summary) {
    const font = label === 'TOTAL' ? bold : regular, size = label === 'TOTAL' ? 12 : 10;
    draw(label, margin + 230, y, size, font);
    const amount = safePDFText(money(cents, data.currency));
    const fittedSize = Math.min(size, 155 * size / font.widthOfTextAtSize(amount, size));
    draw(amount, pageWidth - margin - font.widthOfTextAtSize(amount, fittedSize), y, fittedSize, font);
    y -= 21;
  }
  if (data.notes) { y -= 12; paragraph('NOTES', { size: 9, font: bold, color: green, gap: 0 }); paragraph(data.notes); }
  const changed = [data.invoiceNumber, data.business, data.customer, data.currency, data.notes, ...data.items.map(item => item.description)].some(value => safePDFText(value) !== value);
  if (changed) paragraph('PDF text uses basic Latin replacements. Check names and details before sharing.', { size: 8, color: muted });
  pdf.getPages().forEach((sheet, index, pages) => sheet.drawText(`Page ${index + 1} of ${pages.length}`, { x: margin, y: 28, size: 8, font: regular, color: muted }));
  const name = data.invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'invoice';
  return {
    blob: new Blob([await pdf.save()], { type: 'application/pdf' }), filename: `invoice-${name}.pdf`,
    text: `Invoice ${data.invoiceNumber}\nSubtotal: ${money(data.subtotalCents, data.currency)}\nDiscount: ${money(data.discountCents, data.currency)}\nTaxable subtotal: ${money(data.taxableCents, data.currency)}\nTax (${data.taxRate}%): ${money(data.taxCents, data.currency)}\nTotal: ${money(data.totalCents, data.currency)}\n\nDiscount applied before tax; two-decimal rounding, half up.${changed ? '\nPDF text uses basic Latin replacements for unsupported characters; check names before sharing.' : ''}`,
  };
}

export function formatXML(value) {
  const text = inputText(value, 'XML');
  if (/<!DOCTYPE\b/i.test(text)) throw Error('DTD declarations and external entities are not supported.');
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw Error('XML formatting requires a browser XML parser.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagNameNS('http://www.mozilla.org/newlayout/xml/parsererror.xml', 'parsererror').length) throw Error('Malformed XML. Check matching tags, quoted attributes and escaped entities.');
  const indent = (element, depth, inheritedPreserve = false) => {
    const space = element.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space');
    const preserve = space === 'preserve' || (space !== 'default' && inheritedPreserve);
    const children = Array.from(element.childNodes);
    if (preserve || children.some(node => node.nodeType === 4 || (node.nodeType === 3 && node.nodeValue.trim()))) return;
    const content = children.filter(node => node.nodeType !== 3);
    if (!content.length) return;
    for (const child of content) if (child.nodeType === 1) indent(child, depth + 1, preserve);
    for (const child of children) if (child.nodeType === 3) element.removeChild(child);
    for (const child of content) element.insertBefore(doc.createTextNode(`\n${'  '.repeat(depth + 1)}`), child);
    element.appendChild(doc.createTextNode(`\n${'  '.repeat(depth)}`));
  };
  indent(doc.documentElement, 0);
  const output = new XMLSerializer().serializeToString(doc);
  const declaration = /^\s*(<\?xml\s[^?]*\?>)/i.exec(text)?.[1];
  return declaration && !output.startsWith('<?xml') ? `${declaration}\n${output}` : output;
}

export function browserFacts(nav) {
  if (!nav) throw Error('Browser information is unavailable in this environment.');
  return {
    userAgent: nav.userAgent || 'Not exposed', vendor: nav.vendor || 'Not exposed',
    legacyPlatform: nav.platform || 'Not exposed', language: nav.language || 'Not exposed',
    languages: Array.from(nav.languages || []), cookiesEnabled: nav.cookieEnabled ?? 'Not exposed',
    logicalProcessors: nav.hardwareConcurrency ?? 'Not exposed', maximumTouchPoints: nav.maxTouchPoints ?? 'Not exposed',
    approximateDeviceMemoryGB: nav.deviceMemory ?? 'Not exposed',
    userAgentClientHints: nav.userAgentData ? {
      brands: Array.from(nav.userAgentData.brands || []).map(({ brand, version }) => ({ brand, version })),
      mobile: nav.userAgentData.mobile, platform: nav.userAgentData.platform,
    } : 'Not exposed',
    note: 'Values are reported by this browser and may be reduced or spoofed. Logical processors and memory may be capped. No definitive browser or OS identification is inferred.',
  };
}

async function placeholder(values) {
  const width = integer(values.width, 'Width', 1, 8192), height = integer(values.height, 'Height', 1, 8192);
  if (width * height > 16_000_000) throw Error('Use dimensions below 16 million pixels total.');
  for (const key of ['background', 'color']) if (!/^#[\da-f]{6}$/i.test(values[key])) throw Error('Use six-digit hexadecimal colors.');
  const fontSize = integer(values.fontSize, 'Font size', 1, 1000);
  const label = limitedText(values.text, 'Label', 200).replace(/\s+/g, ' ') || `${width} × ${height}`;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas is unavailable in this browser.');
  context.fillStyle = values.background; context.fillRect(0, 0, width, height);
  context.fillStyle = values.color; context.font = `${Math.min(fontSize, height * .7)}px Arial, sans-serif`;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(label, width / 2, height / 2, Math.max(1, width - Math.min(32, width / 5)));
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('The browser could not encode the PNG image.');
  return { blob, preview: true, filename: `placeholder-${width}x${height}.png`, text: `${width} × ${height} px\nPNG image\n${blob.size.toLocaleString()} bytes` };
}

export async function processReferenceBrowser(tool, values, files = []) {
  void files;
  switch (tool.mode) {
    case 'invoice': return invoicePDF(values);
    case 'xml': return { text: formatXML(values.text), filename: 'formatted.xml' };
    case 'browser-info': return { text: JSON.stringify(browserFacts(globalThis.navigator), null, 2), filename: 'browser-info.json' };
    case 'placeholder': return placeholder(values);
    case 'sql': {
      const text = inputText(values.text, 'SQL');
      if (!['sql', 'postgresql', 'mysql', 'sqlite'].includes(values.language)) throw Error('Choose a supported SQL dialect.');
      const { format } = await import('sql-formatter');
      return { text: format(text, { language: values.language, keywordCase: 'upper', tabWidth: 2 }), filename: 'formatted.sql' };
    }
    case 'html-editor': {
      const text = inputText(values.text, 'HTML');
      const module = await import('dompurify');
      const htmlPreview = module.default.sanitize(text, {
        USE_PROFILES: { html: true }, ADD_TAGS: ['style'], FORCE_BODY: true,
        FORBID_TAGS: ['script', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base', 'img', 'video', 'audio', 'source'],
        FORBID_ATTR: ['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'xlink:href'],
      });
      return { text, htmlPreview: htmlPreview || '<p>No previewable HTML remains after sanitation.</p>', filename: 'edited.html' };
    }
    default: throw Error('This browser operation is not implemented.');
  }
}
