export const slugify = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/→/g, ' to ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function number(value, label = 'Value', min = -Infinity, max = Infinity) {
  if (String(value).trim() === '') throw Error(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function positive(v, label = 'Value') { const n = number(v, label, 0); if (!n) throw Error(`${label} must be greater than zero.`); return n; }
export function nonzero(v,label='Value'){const n=number(v,label);if(n===0)throw Error(`${label} cannot be zero.`);return n;}
export function list(value, min = 1) {
  const values = String(value).trim().split(/[\s,;]+/).filter(Boolean).map(v => number(v));
  if (values.length < min || values.length > 10000) throw Error(`Enter ${min} to 10,000 numbers.`);
  return values;
}
export const sum = a => a.reduce((s, v) => s + v, 0);
export const round = n => Number(Number(n).toPrecision(12));
export function gcd(a,b) { a=Math.abs(a); b=Math.abs(b); while(b) [a,b]=[b,a%b]; return a; }
export function integer(v,label='Value',min=0,max=Number.MAX_SAFE_INTEGER){const n=number(v,label,min,max);if(!Number.isSafeInteger(n))throw Error(`${label} must be a whole number.`);return n;}
export function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Error('Enter a date in YYYY-MM-DD format.');
  const d = new Date(v+'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==v) throw Error('Enter a valid calendar date.');
  return d;
}
export const iso = d => d.toISOString().slice(0,10);
export const DAY = 86400000;
export function csvRows(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('CSV contains an unclosed quote.');
  if(cell||row.length){row.push(cell);rows.push(row);} return rows;
}
export const csvCell = v => '"'+String(v??'').replaceAll('"','""')+'"';
export function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function httpURL(s){const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw Error('Enter an http or https URL.');return u;}
