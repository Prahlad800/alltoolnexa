import { escapeHTML } from '../../shared/core.mjs';

const amount = cents => (cents / 100).toFixed(2);
export const invoiceName = data => `invoice-${data.invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'invoice'}`;
const totals = data => [
  ['Subtotal', data.subtotalCents], ['Discount', -data.discountCents],
  ['Taxable subtotal', data.taxableCents], [`Tax (${data.taxRate}%)`, data.taxCents], ['TOTAL', data.totalCents],
];
export function invoiceSummary(data) {
  return `Invoice ${data.invoiceNumber}\n${totals(data).map(([label, cents]) => `${label}: ${data.currency} ${amount(cents)}`).join('\n')}\n\nDiscount applied before tax; two-decimal rounding, half up.`;
}

export function invoiceHTML(data) {
  const e = value => escapeHTML(String(value));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Invoice ${e(data.invoiceNumber)}</title><style>body{font:16px/1.5 Arial,sans-serif;color:#182d24;margin:0;background:#f3f6f4}main{max-width:900px;margin:32px auto;padding:40px;background:white}h1{color:#245c46}p,.details{white-space:pre-wrap;overflow-wrap:anywhere}.parties{display:flex;gap:40px;flex-wrap:wrap}.parties>section{flex:1;min-width:200px}table{border-collapse:collapse;width:100%;margin-top:24px;table-layout:fixed}th,td{padding:10px;border-bottom:1px solid #ccd8d0;text-align:right;overflow-wrap:anywhere}th:first-child,td:first-child{text-align:left;width:46%}thead{background:#e7ede9}tfoot th{text-align:right}small{color:#526458}@media print{body{background:white}main{margin:0;padding:0}tr{break-inside:avoid}thead{display:table-header-group}}@media(max-width:600px){main{margin:0;padding:16px}th,td{padding:6px;font-size:13px}}</style></head><body><main><h1>INVOICE</h1><p>${e(data.invoiceNumber)}\nIssued: ${e(data.issueDate)} · Due: ${e(data.dueDate)}\nCurrency: ${e(data.currency)}</p><div class="parties"><section><h2>From</h2><div class="details">${e(data.business)}</div></section><section><h2>Bill to</h2><div class="details">${e(data.customer)}</div></section></div><table><thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Rate</th><th scope="col">Amount</th></tr></thead><tbody>${data.items.map(item => `<tr><td>${e(item.description)}</td><td>${e(item.quantity)}</td><td>${amount(item.rateCents)}</td><td>${amount(item.amountCents)}</td></tr>`).join('')}</tbody><tfoot>${totals(data).map(([label, cents]) => `<tr><th colspan="3" scope="row">${e(label)}</th><td>${amount(cents)}</td></tr>`).join('')}</tfoot></table>${data.notes ? `<h2>Notes</h2><p>${e(data.notes)}</p>` : ''}<p><small>Amounts in ${e(data.currency)}. Discount applied before tax; two-decimal rounding, half up.</small></p></main></body></html>`;
}

function invoiceRows(data) {
  return [
    ['Invoice', data.invoiceNumber], ['Issued', data.issueDate], ['Due', data.dueDate],
    ['Currency', data.currency], ['From', data.business], ['Bill to', data.customer], [],
    ['Description', 'Quantity', 'Rate', 'Amount'],
    ...data.items.map(item => [item.description, Number(item.quantity), item.rateCents / 100, item.amountCents / 100]),
    [], ...totals(data).map(([label, cents]) => [label, '', '', cents / 100]),
    ['Notes', data.notes], ['Rounding', 'Two decimals, half up; discount before tax.'],
  ];
}

// CSV has no string type. Prefix text which spreadsheet apps could execute as formulas.
export function invoiceCSV(data) {
  const cell = value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + invoiceRows(data).map(row => row.map(cell).join(',')).join('\r\n');
}

export async function invoiceWorkbook(data) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip(), xml = text => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + text;
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const e = value => escapeHTML(String(value));
  zip.file('[Content_Types].xml', xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'));
  zip.file('_rels/.rels', xml(`<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`));
  zip.file('xl/workbook.xml', xml(`<workbook xmlns="${main}" xmlns:r="${officeRel}"><sheets><sheet name="Invoice" sheetId="1" r:id="rId1"/></sheets></workbook>`));
  zip.file('xl/_rels/workbook.xml.rels', xml(`<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${officeRel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeRel}/styles" Target="styles.xml"/></Relationships>`));
  zip.file('xl/styles.xml', xml(`<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF245C46"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`));
  const rows = invoiceRows(data);
  const cells = rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
    const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
    return typeof value === 'number'
      ? `<c r="${ref}" s="${c >= 2 ? 1 : 0}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${r === 7 ? 2 : 0}" t="inlineStr"><is><t xml:space="preserve">${e(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  zip.file('xl/worksheets/sheet1.xml', xml(`<worksheet xmlns="${main}"><dimension ref="A1:D${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols><col min="1" max="1" width="52" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/></cols><sheetData>${cells}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`));
  return new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Native canvas supports the user's installed Unicode fonts without any remote requests.
export async function invoicePhotos(data, type = 'image/png') {
  if (typeof document === 'undefined') throw Error('Photo export requires a browser.');
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas is unavailable in this browser.');
  const pages = [], margin = 70, lineHeight = 30, bottom = 1640;
  let y = margin;
  const reset = () => { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#182d24'; context.textBaseline = 'top'; y = margin; };
  const save = async () => {
    context.font = '18px Arial,sans-serif'; context.fillStyle = '#526458';
    context.fillText(`Invoice ${data.invoiceNumber} · Page ${pages.length + 1}`, margin, 1680, 1100);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, .93));
    if (!blob) throw Error('Could not encode the invoice photo.');
    pages.push(blob); reset();
  };
  const wrap = (text, width) => {
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (line && context.measureText(line + char).width > width) { lines.push(line); line = ''; }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  };
  const paragraph = async (text, bold = false, size = 23) => {
    context.font = `${bold ? 'bold ' : ''}${size}px Arial,sans-serif`;
    const lines = wrap(text, 1100);
    for (const line of lines) {
      if (y + lineHeight > bottom) { await save(); context.font = `${bold ? 'bold ' : ''}${size}px Arial,sans-serif`; }
      context.fillStyle = '#182d24'; context.fillText(line, margin, y); y += lineHeight;
    }
    y += 14;
  };
  const header = () => {
    context.font = 'bold 21px Arial,sans-serif'; context.fillStyle = '#e7ede9'; context.fillRect(margin, y - 8, 1100, 42);
    context.fillStyle = '#182d24';
    ['Description', 'Qty', 'Rate', 'Amount'].forEach((text, i) => context.fillText(text, [70, 720, 845, 1010][i], y)); y += 48;
  };
  try {
    reset(); await paragraph('INVOICE', true, 40);
    await paragraph(`${data.invoiceNumber}\nIssued: ${data.issueDate} · Due: ${data.dueDate}\nCurrency: ${data.currency}`);
    await paragraph('FROM', true); await paragraph(data.business);
    await paragraph('BILL TO', true); await paragraph(data.customer);
    if (y + 90 > bottom) await save(); header();
    for (const item of data.items) {
      context.font = '22px Arial,sans-serif';
      const lines = wrap(item.description, 620), height = lines.length * lineHeight + 18;
      if (y + height > bottom) { await save(); header(); }
      context.font = '22px Arial,sans-serif'; context.fillStyle = '#182d24';
      lines.forEach((line, i) => context.fillText(line, margin, y + i * lineHeight));
      [item.quantity, amount(item.rateCents), amount(item.amountCents)].forEach((text, i) => context.fillText(text, [720, 845, 1010][i], y, [110, 150, 160][i]));
      y += height;
    }
    y += 20;
    for (const [label, cents] of totals(data)) await paragraph(`${label}: ${data.currency} ${amount(cents)}`, label === 'TOTAL');
    if (data.notes) { await paragraph('NOTES', true); await paragraph(data.notes); }
    await paragraph('Discount before tax. Two decimals, half up.', false, 19);
    await save(); return pages;
  } finally { canvas.width = 1; canvas.height = 1; }
}

async function archive(entries) {
  const { default: JSZip } = await import('jszip'), zip = new JSZip();
  for (const [name, value] of entries) zip.file(name, value instanceof Blob ? await value.arrayBuffer() : value);
  return new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })], { type: 'application/zip' });
}

export async function exportInvoice(data, format, createPDF) {
  const name = invoiceName(data), text = invoiceSummary(data);
  const file = (blob, ext, extra = {}) => ({ blob, filename: `${name}.${ext}`, text, ...extra });
  switch (format) {
    case 'PDF': return createPDF();
    case 'HTML': { const html = invoiceHTML(data); return file(new Blob([html], { type: 'text/html;charset=utf-8' }), 'html', { htmlPreview: html }); }
    case 'Excel (XLSX)': return file(await invoiceWorkbook(data), 'xlsx');
    case 'CSV': return file(new Blob([invoiceCSV(data)], { type: 'text/csv;charset=utf-8' }), 'csv', { warning: 'Text starting with formula characters is prefixed with an apostrophe for spreadsheet safety. CSV does not preserve invoice styling.' });
    case 'JSON': return file(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'json', { warning: 'JSON monetary fields ending in Cents contain integer cents.' });
    case 'PNG photo': case 'JPEG photo': {
      const ext = format === 'PNG photo' ? 'png' : 'jpg';
      const photos = await invoicePhotos(data, ext === 'png' ? 'image/png' : 'image/jpeg');
      if (photos.length === 1) return file(photos[0], ext, { preview: true });
      return file(await archive(photos.map((blob, i) => [`${name}-page-${i + 1}.${ext}`, blob])), 'zip', { warning: `Invoice spans ${photos.length} photo pages; all pages are included in this ZIP.` });
    }
    case 'All formats (ZIP)': {
      const pdf = await createPDF(), photos = await invoicePhotos(data), jpegs = await invoicePhotos(data, 'image/jpeg');
      const entries = [[`${name}.pdf`, pdf.blob], [`${name}.html`, invoiceHTML(data)], [`${name}.xlsx`, await invoiceWorkbook(data)], [`${name}.csv`, invoiceCSV(data)], [`${name}.json`, JSON.stringify(data, null, 2)]];
      photos.forEach((blob, i) => entries.push([`${name}-page-${i + 1}.png`, blob]));
      jpegs.forEach((blob, i) => entries.push([`${name}-page-${i + 1}.jpg`, blob]));
      entries.push(['README.txt', 'HTML and photos preserve Unicode using browser fonts. PDF uses basic Latin replacements for unsupported text. CSV formula-like strings are prefixed with an apostrophe; styling is not preserved. JSON monetary Cents fields are integer cents. All formats use discount before tax and two-decimal half-up rounding.']);
      return file(await archive(entries), 'zip', { warning: pdf.text.includes('basic Latin') ? 'PDF uses basic Latin replacements for unsupported characters. HTML and photos preserve Unicode using available browser fonts.' : undefined });
    }
    default: throw Error('Choose a supported invoice export format.');
  }
}
