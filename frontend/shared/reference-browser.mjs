export function extendReferenceBrowser({ register, field, aliases }) {
  const add = (category, name, mode, fields, formula, description) => register(
    category, name, fields, formula,
    () => { throw Error('Run this tool in the browser.'); },
    { kind: 'reference-browser', mode, nofile: true, description },
  );
  add('templates', 'Invoice Generator', 'invoice', [
    field('invoiceNumber', 'Invoice number', 'INV-001', 'text'),
    field('business', 'Your business and address', 'Example Studio\n123 Market Street', 'textarea'),
    field('customer', 'Bill to: customer and address', 'Client Company\n456 Park Road', 'textarea'),
    field('issueDate', 'Invoice date', '2026-01-01', 'date'),
    field('dueDate', 'Due date', '2026-01-31', 'date'),
    field('currency', 'Currency label (two decimal places)', 'USD', 'text'),
    field('items', 'Line items CSV: description,quantity,rate', 'description,quantity,rate\nDesign services,2,125.00\nProject consultation,1.5,80.00', 'textarea'),
    field('discount', 'Discount amount before tax', 0),
    field('tax', 'Tax on discounted subtotal (%)', 10),
    field('notes', 'Notes or payment details', 'Thank you for your business.', 'textarea'),
    field('exportFormat', 'Download format', 'PDF', 'select', ['PDF', 'HTML', 'Excel (XLSX)', 'CSV', 'PNG photo', 'JPEG photo', 'JSON', 'All formats (ZIP)']),
  ], 'Each line is rounded to two decimals, half up. Discount is subtracted from the subtotal before tax; tax is rounded half up. Total = subtotal - discount + tax. Rates and discount allow two decimal places; quantities allow six; tax allows four. PDF text uses basic Latin replacements for unsupported characters.',
  'Create an invoice and export PDF, printable HTML, styled Excel XLSX, CSV, PNG/JPEG photos, JSON or a ZIP with all formats. Multi-page photos download as a ZIP. Amounts use two decimal places for your chosen currency label; no currency conversion or tax policy is inferred.');
  add('developer', 'XML Formatter', 'xml', [
    field('text', 'XML', '<catalog><tool id="one"><name>Useful tool</name><free>true</free></tool></catalog>', 'textarea'),
  ], 'Parse XML with the browser XML parser and indent element-only content. Mixed content, CDATA and xml:space="preserve" are preserved. Malformed XML and DTD declarations are rejected.',
  'Format well-formed XML locally while preserving mixed text and inline elements. DTDs and external entities are not supported.');
  add('developer', 'SQL Formatter', 'sql', [
    field('text', 'SQL', 'select id, email from users where active = true order by id;', 'textarea'),
    field('language', 'SQL dialect', 'sql', 'select', ['sql', 'postgresql', 'mysql', 'sqlite']),
  ], 'Format SQL locally with sql-formatter and your selected dialect. Parser errors are reported. Formatting does not execute SQL or validate every database syntax or semantic rule.',
  'Indent SQL statements and standardize keyword casing with a dialect-aware formatter. No database connection is used.');
  add('developer', 'What Is My Browser', 'browser-info', [],
    'Report only navigator values exposed by this browser. User-agent and client-hint data can be reduced, spoofed or restricted; no definitive browser version or operating system is inferred.',
    'Inspect this browser’s reported user agent, languages, platform and supported local device facts without an external lookup.');
  add('image', 'Dummy Image Placeholder Generator', 'placeholder', [
    field('width', 'Width (px)', 1200), field('height', 'Height (px)', 630),
    field('background', 'Background color', '#e7ede9', 'color'),
    field('color', 'Text color', '#245c46', 'color'),
    field('text', 'Label (blank uses dimensions)', '', 'text'),
    field('fontSize', 'Font size (px)', 48),
  ], 'Draw a solid-color placeholder and centered label on a local canvas, then export a PNG. Use whole-number dimensions up to 8,192 px and no more than 16 million pixels total.',
  'Generate a downloadable PNG placeholder in your own dimensions, colors and label.');
  add('developer', 'HTML Editor', 'html-editor', [
    field('text', 'HTML and CSS', '<style>.card { padding: 24px; border-radius: 12px; background: #e7ede9; color: #245c46; font-family: Arial; }</style>\n<section class="card"><h1>Hello, useful tools.</h1><p>Edit this HTML and CSS to see your layout.</p></section>', 'textarea'),
  ], 'Preview sanitized HTML and CSS in an isolated iframe. Scripts, forms, navigation, embedded pages and network resources are disabled. Download preserves your original source; preview sanitation can change its appearance.',
  'Edit HTML and inline CSS locally with an isolated preview. JavaScript and network resources are disabled in the preview.');
  Object.assign(aliases, {
    'dummy-image-generator': 'dummy-image-placeholder-generator',
    'placeholder-image-generator': 'dummy-image-placeholder-generator',
    'browser-info': 'what-is-my-browser',
  });
}
