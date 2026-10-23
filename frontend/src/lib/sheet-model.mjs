// A bounded spreadsheet model. Formulas are parsed as data; never executed as JS.
export const MAX_ROWS = 10000;
export const MAX_COLS = 256;
export const MAX_SHEETS = 20;
export const MAX_CELLS = 100000;
// Evaluation limits stay independent of workbook capacity and viewport size.
export const MAX_FORMULA_RANGE_CELLS = 10000;
export const SUPPORTED_FUNCTIONS = Object.freeze(['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','IF','IFERROR','ROUND','ABS','AND','OR','NOT','LEFT','RIGHT','LEN','TRIM','UPPER','LOWER','CONCAT','COUNTIF','SUMIF']);
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
class FormulaError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new FormulaError(code); };
const finite = n => Number.isFinite(n) ? n : fail('#NUM!');

export function colName(index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 16384) throw new Error('Invalid column index.');
  let result = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
export function parseAddress(value) {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/i.exec(String(value));
  if (!match) throw new Error('Invalid cell address.');
  let col = 0;
  for (const letter of match[1].toUpperCase()) col = col * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]) - 1;
  if (col > 16384 || row >= 1048576) throw new Error('Cell address is outside Excel bounds.');
  return { row, col: col - 1 };
}
export function address(row, col) {
  if (!Number.isSafeInteger(row) || row < 0 || row >= 1048576) throw new Error('Invalid row index.');
  return colName(col) + (row + 1);
}
export function rangeAddresses(start, end = start) {
  const a = parseAddress(start), b = parseAddress(end);
  const top = Math.min(a.row,b.row), bottom = Math.max(a.row,b.row), left = Math.min(a.col,b.col), right = Math.max(a.col,b.col);
  if ((bottom-top+1)*(right-left+1) > MAX_CELLS) throw new Error(`Select at most ${MAX_CELLS.toLocaleString('en-US')} cells.`);
  const result = [];
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) result.push(address(row,col));
  return result;
}

function tokensFor(source) {
  if (source.length > 8192) fail('#ERROR!');
  const tokens = [];
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue; }
    let m;
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++]; let text = '', closed = false;
      while (i < source.length) {
        if (source[i] === quote) { if (source[i+1] === quote) { text += quote; i += 2; } else { i++; closed = true; break; } }
        else text += source[i++];
      }
      if (!closed) fail('#ERROR!');
      tokens.push({type:quote === '"' ? 'string' : 'name',value:text});
    } else if ((m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(i)))) {
      tokens.push({type:'number',value:finite(Number(m[0]))}); i += m[0].length;
    } else if ((m = /^\$?[A-Za-z_][A-Za-z0-9_.$]*/.exec(source.slice(i)))) {
      tokens.push({type:'name',value:m[0]}); i += m[0].length;
    } else if ((m = /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|CYCLE!|ERROR!)/i.exec(source.slice(i)))) {
      tokens.push({type:'error',value:m[0].toUpperCase()}); i += m[0].length;
    } else if ((m = /^(?:<=|>=|<>|[+\-*/^&%=<>():,!;])/.exec(source.slice(i)))) {
      tokens.push({type:m[0] === ';' ? ',' : m[0],value:m[0]}); i += m[0].length;
    } else fail('#ERROR!');
    if (tokens.length > 2048) fail('#ERROR!');
  }
  tokens.push({type:'end'}); return tokens;
}
function parseFormula(source) {
  const tokens = tokensFor(source); let pos = 0, depth = 0;
  const peek = () => tokens[pos].type;
  const eat = type => { if (peek() !== type) fail('#ERROR!'); return tokens[pos++]; };
  function primary() {
    if (++depth > 100) fail('#ERROR!');
    let node;
    if (peek() === '(') { eat('('); node = expression(0); eat(')'); }
    else if (['number','string','error'].includes(peek())) { const t = tokens[pos++]; node = {kind:t.type,value:t.value}; if(t.type==='error'&&peek()===':') { eat(':'); if(!['name','error'].includes(peek())) fail('#ERROR!'); pos++; } }
    else if (peek() === 'name') {
      const name = eat('name').value;
      if (peek() === '(') {
        eat('('); const args = [];
        if (peek() !== ')') { do { if (peek() === ',') fail('#ERROR!'); args.push(expression(0)); if (peek() !== ',') break; eat(','); } while (true); }
        eat(')'); node = {kind:'function',name:name.toUpperCase(),args};
      } else {
        let sheet, ref = name;
        if (peek() === '!') { eat('!'); sheet = name; ref = eat('name').value; }
        if (!sheet && /^(TRUE|FALSE)$/i.test(ref)) node = {kind:'boolean',value:ref.toUpperCase() === 'TRUE'};
        else {
          try { parseAddress(ref); } catch { fail('#NAME?'); }
          node = {kind:'ref',sheet,ref};
          if (peek() === ':') { eat(':'); if(peek()==='error') node={kind:'error',value:eat('error').value}; else { const end = eat('name').value; try { parseAddress(end); } catch { fail('#REF!'); } node = {kind:'range',sheet,start:ref,end}; } }
        }
      }
    } else fail('#ERROR!');
    depth--; return node;
  }
  const precedence = {'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5};
  function expression(min) {
    let node;
    if (peek() === '+' || peek() === '-') { const op = tokens[pos++].type; node = {kind:'unary',op,value:expression(5)}; }
    else node = primary();
    while (peek() === '%') { eat('%'); node = {kind:'unary',op:'%',value:node}; }
    while (precedence[peek()] >= min) {
      const op = tokens[pos++].type, p = precedence[op];
      node = {kind:'binary',op,left:node,right:expression(op === '^' ? p : p+1)};
    }
    return node;
  }
  const result = expression(0); eat('end'); return result;
}
function numeric(value) {
  if (Array.isArray(value)) fail('#VALUE!');
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === '' || value == null) return 0;
  if (numberPattern.test(String(value).trim())) return finite(Number(value));
  fail('#VALUE!');
}
function scalar(value) { if (Array.isArray(value)) fail('#VALUE!'); return value; }
function truth(value) {
  value = scalar(value);
  if (typeof value === 'boolean') return value;
  if (value === '' || value == null) return false;
  if (typeof value === 'number') return value !== 0;
  if (/^(true|false)$/i.test(value)) return /^true$/i.test(value);
  fail('#VALUE!');
}
const textValue = value => { value = scalar(value); return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value ?? ''); };
function compare(a,b) {
  a = scalar(a); b = scalar(b);
  if (a === '' && typeof b === 'number') a = 0;
  if (b === '' && typeof a === 'number') b = 0;
  if (typeof a !== typeof b) { const rank = {number:0,string:1,boolean:2}; return (rank[typeof a] ?? -1) < (rank[typeof b] ?? -1) ? -1 : 1; }
  if (typeof a === 'string') a = a.toLowerCase();
  if (typeof b === 'string') b = b.toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}
function matchesCriteria(value, criteria) {
  if (typeof criteria !== 'string') return compare(value,criteria) === 0;
  const m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(criteria), op = m?.[1] || '=', target = m?.[2] ?? criteria;
  const rhs = numberPattern.test(target) ? Number(target) : target;
  if ((op === '=' || op === '<>') && typeof rhs === 'string' && /[*?~]/.test(rhs)) {
    const pattern = [];
    for (let i = 0; i < rhs.length; i++) {
      let ch = rhs[i], literal = false;
      if (ch === '~' && i+1 < rhs.length) { ch = rhs[++i]; literal = true; }
      pattern.push({ch:ch.toLowerCase(),wild:!literal&&(ch==='*'||ch==='?')});
    }
    const input=String(value??'').toLowerCase(); let p=0,t=0,star=-1,retry=0,steps=0;
    while(t<input.length) {
      if(++steps>100000) fail('#NUM!');
      if(p<pattern.length&&(!pattern[p].wild&&pattern[p].ch===input[t]||pattern[p].wild&&pattern[p].ch==='?')) { p++;t++; }
      else if(p<pattern.length&&pattern[p].wild&&pattern[p].ch==='*') { star=p++;retry=t; }
      else if(star>=0) { p=star+1;t=++retry; }
      else break;
    }
    while(p<pattern.length&&pattern[p].wild&&pattern[p].ch==='*') p++;
    const match=t===input.length&&p===pattern.length; return op === '<>' ? !match : match;
  }
  if(typeof rhs==='number'&&typeof value!=='number'&&value!=='') return op==='<>';
  const c = compare(value,rhs);
  return ({'=':c===0,'<>':c!==0,'<':c<0,'>':c>0,'<=':c<=0,'>=':c>=0})[op];
}

export function evaluateCell(sheet, cellAddress, allSheets = []) {
  const sheets = Array.isArray(allSheets) ? allSheets : allSheets?.sheets || [];
  const memo = new Map(), visiting = new Set(); let budget = 50000;
  function read(target, ref, depth = 0) {
    if (--budget < 0 || depth > 100) fail('#NUM!');
    let point; try { point = parseAddress(ref); } catch { fail('#REF!'); }
    if (point.row >= MAX_ROWS || point.col >= MAX_COLS || !target) fail('#REF!');
    const canonical = address(point.row,point.col), key = (target.id || target.name || sheets.indexOf(target))+'!'+canonical;
    if (visiting.has(key)) fail('#CYCLE!');
    if (memo.has(key)) return memo.get(key);
    visiting.add(key);
    try {
      const item = target.cells?.[canonical], raw = item && typeof item === 'object' ? item.v : item;
      let result = raw == null ? '' : raw;
      if (typeof raw === 'string') {
        if (raw.startsWith("'")) result = raw.slice(1);
        else if (raw.startsWith('=')) result = scalar(run(parseFormula(raw.slice(1)),target,depth+1));
        else if (numberPattern.test(raw.trim())) result = finite(Number(raw.trim()));
      }
      memo.set(key,result); return result;
    } finally { visiting.delete(key); }
  }
  function run(node,target,depth) {
    if (--budget < 0 || depth > 200) fail('#NUM!');
    const ev = n => run(n,target,depth+1);
    if (['number','string','boolean'].includes(node.kind)) return node.value;
    if (node.kind === 'error') fail(node.value);
    if (node.kind === 'ref' || node.kind === 'range') {
      const destination = node.sheet ? [target,...sheets].find(s => s.name?.toLowerCase() === node.sheet.toLowerCase()) : target;
      if (!destination) fail('#REF!');
      if (node.kind === 'ref') return read(destination,node.ref,depth+1);
      const start=parseAddress(node.start),end=parseAddress(node.end);
      if(start.row>=MAX_ROWS||end.row>=MAX_ROWS||start.col>=MAX_COLS||end.col>=MAX_COLS) fail('#REF!');
      if((Math.abs(end.row-start.row)+1)*(Math.abs(end.col-start.col)+1)>MAX_FORMULA_RANGE_CELLS) fail('#NUM!');
      let refs; try { refs = rangeAddresses(node.start,node.end); } catch { fail('#REF!'); }
      return refs.map(ref => read(destination,ref,depth+1));
    }
    if (node.kind === 'unary') { const value = numeric(ev(node.value)); return finite(node.op === '-' ? -value : node.op === '%' ? value/100 : value); }
    if (node.kind === 'binary') {
      const a = ev(node.left), b = ev(node.right);
      if (node.op === '&') return textValue(a)+textValue(b);
      if (['=','<>','<','>','<=','>='].includes(node.op)) { const c = compare(a,b); return ({'=':c===0,'<>':c!==0,'<':c<0,'>':c>0,'<=':c<=0,'>=':c>=0})[node.op]; }
      const x = numeric(a), y = numeric(b);
      if (node.op === '/' && y === 0) fail('#DIV/0!');
      return finite(node.op === '+' ? x+y : node.op === '-' ? x-y : node.op === '*' ? x*y : node.op === '/' ? x/y : x**y);
    }
    if (node.kind !== 'function' || !SUPPORTED_FUNCTIONS.includes(node.name)) fail('#NAME?');
    const n = node.name, count = node.args.length;
    const arity = (min,max=min) => { if (count < min || count > max) fail('#VALUE!'); };
    if (n === 'IF') { arity(2,3); return truth(ev(node.args[0])) ? ev(node.args[1]) : count === 3 ? ev(node.args[2]) : false; }
    if (n === 'IFERROR') { arity(2); try { return ev(node.args[0]); } catch(error) { if (!(error instanceof FormulaError)) throw error; return ev(node.args[1]); } }
    if (['SUM','AVERAGE','MIN','MAX','COUNT','COUNTA','AND','OR','CONCAT'].includes(n)) {
      arity(1,255); const values = node.args.map(ev).flat();
      if (n === 'CONCAT') return values.map(textValue).join('');
      if (n === 'COUNTA') return values.filter(v => v !== '' && v != null).length;
      if (n === 'AND' || n === 'OR') { const logical = values.filter(v => typeof v !== 'string' && v != null).map(truth); if (!logical.length) fail('#VALUE!'); return n === 'AND' ? logical.every(Boolean) : logical.some(Boolean); }
      const nums = values.filter(v => typeof v === 'number');
      if (n === 'COUNT') return nums.length;
      if (n === 'AVERAGE' && !nums.length) fail('#DIV/0!');
      if (n === 'MIN') return nums.length ? Math.min(...nums) : 0;
      if (n === 'MAX') return nums.length ? Math.max(...nums) : 0;
      const total = finite(nums.reduce((sum,v) => sum+v,0)); return n === 'AVERAGE' ? total/nums.length : total;
    }
    if (n === 'COUNTIF' || n === 'SUMIF') {
      arity(2,n === 'SUMIF' ? 3 : 2);
      const source = ev(node.args[0]), criteria = scalar(ev(node.args[1])), sums = n === 'SUMIF' && count === 3 ? ev(node.args[2]) : source;
      if (!Array.isArray(source) || !Array.isArray(sums) || source.length !== sums.length) fail('#VALUE!');
      return finite(source.reduce((total,value,i) => total + (matchesCriteria(value,criteria) ? n === 'COUNTIF' ? 1 : typeof sums[i] === 'number' ? sums[i] : 0 : 0),0));
    }
    if (n === 'ROUND') { arity(2); const value=numeric(ev(node.args[0])), digits=Math.trunc(numeric(ev(node.args[1]))); if (Math.abs(digits)>100) fail('#NUM!'); const scale=10**digits; return finite(Math.sign(value)*Math.round((Math.abs(value)+Number.EPSILON)*scale)/scale); }
    if (n === 'ABS') { arity(1); return Math.abs(numeric(ev(node.args[0]))); }
    if (n === 'NOT') { arity(1); return !truth(ev(node.args[0])); }
    if (n === 'LEFT' || n === 'RIGHT') { arity(1,2); const value=textValue(ev(node.args[0])), length=count===2?Math.trunc(numeric(ev(node.args[1]))):1; if(length<0) fail('#VALUE!'); return n === 'LEFT' ? value.slice(0,length) : length ? value.slice(-length) : ''; }
    arity(1); const value=textValue(ev(node.args[0]));
    if (n === 'LEN') return value.length;
    if (n === 'TRIM') return value.trim().replace(/ +/g,' ');
    return n === 'UPPER' ? value.toUpperCase() : value.toLowerCase();
  }
  try { return read(sheet,cellAddress); } catch(error) { return error instanceof FormulaError ? error.code : '#ERROR!'; }
}

export function shiftFormula(formula, deltaRow, deltaCol) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  if (!Number.isSafeInteger(deltaRow) || !Number.isSafeInteger(deltaCol)) throw new Error('Invalid formula offset.');
  // Match double-quoted text first so addresses inside literal strings never move.
  return formula.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'(?=!)|(?<![A-Za-z0-9_.$])(?:\$?[A-Za-z]{1,3}\$?[1-9]\d*)(?![A-Za-z0-9_.$]|\s*[!(])/g, (token,offset,source) => {
    if (token.startsWith('"') || token.startsWith("'")) return token;
    // Sheet names such as Sheet1 and LOG10(...) must not be rewritten as cells.
    if (/^\s*[!(]/.test(source.slice(offset+token.length))) return token;
    const match = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(token); let point;
    try { point = parseAddress(token); } catch { return token; }
    const row = point.row+(match[3]?0:deltaRow), col=point.col+(match[1]?0:deltaCol);
    if(row<0||col<0||row>=MAX_ROWS||col>=MAX_COLS) return '#REF!';
    return match[1]+colName(col)+match[3]+(row+1);
  });
}

// Structural edits move references even when their axes are absolute. Sheet
// qualifiers decide which references belong to the sheet that was changed.
export function adjustReferences(formula, axis, index, delta, changedSheetName, formulaSheetName) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  if (!['row','col'].includes(axis) || !Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(delta)) throw new Error('Invalid structural edit.');
  if (!delta) return formula;
  const refs = /"(?:[^"]|"")*"|(?<![A-Za-z0-9_.$])(?:(?<sheet>'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_.]*)!)?(?<ref>\$?[A-Za-z]{1,3}\$?[1-9]\d*)(?![A-Za-z0-9_.$]|\s*[!(])/g;
  // Ranges inherit the first endpoint's sheet qualifier, e.g. Other!A1:B3.
  let inheritedSheet, previousEnd = -1;
  return formula.replace(refs,(token,...args)=> {
    const groups=args.at(-1), offset=args.at(-3), source=args.at(-2);
    if(token.startsWith('"')) { inheritedSheet=undefined; previousEnd=offset+token.length; return token; }
    const qualifier=groups.sheet;
    const qualifiedName=qualifier?.startsWith("'")?qualifier.slice(1,-1).replace(/''/g,"'"):qualifier;
    const inherits=source.slice(previousEnd,offset).trim()===':';
    const sheetName=qualifiedName || (inherits?inheritedSheet:formulaSheetName);
    inheritedSheet=sheetName; previousEnd=offset+token.length;
    if(String(sheetName).toLowerCase()!==String(changedSheetName).toLowerCase()) return token;
    const m=/^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(groups.ref); let point;
    try { point=parseAddress(groups.ref); } catch { return token; }
    const coordinate=point[axis];
    if(delta<0&&coordinate>=index&&coordinate<index-delta) return '#REF!';
    const updated=coordinate>=index?coordinate+delta:coordinate;
    const row=axis==='row'?updated:point.row,col=axis==='col'?updated:point.col;
    if(row<0||row>=MAX_ROWS||col<0||col>=MAX_COLS) return '#REF!';
    return (qualifier?qualifier+'!':'')+m[1]+colName(col)+m[3]+(row+1);
  });
}

export function formatCell(value, style = {}) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  const decimals = Number.isInteger(style.decimals) ? Math.max(0,Math.min(10,style.decimals)) : 2;
  const opts = {minimumFractionDigits:decimals,maximumFractionDigits:decimals};
  try {
    if (style.format === 'number') return new Intl.NumberFormat('en-US',opts).format(value);
    if (style.format === 'currency') return new Intl.NumberFormat('en-US',{...opts,style:'currency',currency:/^[A-Z]{3}$/.test(style.currency)?style.currency:'INR'}).format(value);
    if (style.format === 'percent') return new Intl.NumberFormat('en-US',{...opts,style:'percent'}).format(value);
    if (style.format === 'scientific') return value.toExponential(decimals);
    if (style.format === 'date' || style.format === 'time') {
      const ms = Date.UTC(1899,11,30)+value*86400000, date = new Date(ms);
      if (!Number.isFinite(date.getTime())) return '#NUM!';
      return new Intl.DateTimeFormat('en-GB',style.format==='time'?{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'UTC'}:{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date);
    }
  } catch { return String(value); }
  return String(value);
}

function cleanStyle(source) {
  const s = source && typeof source === 'object' ? source : {}, out = {};
  for (const key of ['bold','italic','underline','wrap']) if (typeof s[key] === 'boolean') out[key] = s[key];
  for (const key of ['color','fill']) if (/^#[0-9a-f]{6}$/i.test(s[key] || '')) out[key] = s[key];
  if (typeof s.fontFamily === 'string' && /^[\w ,'-]{1,80}$/.test(s.fontFamily)) out.fontFamily = s.fontFamily;
  if (Number.isFinite(s.fontSize)) out.fontSize = Math.max(8,Math.min(72,s.fontSize));
  if (['left','center','right'].includes(s.align)) out.align = s.align;
  if (['top','middle','bottom'].includes(s.valign)) out.valign = s.valign;
  if (['none','all','outside','bottom'].includes(s.border)) out.border = s.border;
  if (['general','number','currency','percent','date','time','scientific'].includes(s.format)) out.format = s.format;
  if (Number.isInteger(s.decimals)) out.decimals = Math.max(0,Math.min(10,s.decimals));
  if (/^[A-Z]{3}$/.test(s.currency || '')) out.currency = s.currency;
  return out;
}
function boundedAddress(ref) { const point=parseAddress(ref); if(point.row>=MAX_ROWS||point.col>=MAX_COLS) throw new Error(`Workbook supports up to ${MAX_ROWS.toLocaleString('en-US')} rows and ${MAX_COLS} columns per sheet.`); return address(point.row,point.col); }
export function createWorkbook() { return {name:'Untitled workbook',active:'sheet-1',sheets:[{id:'sheet-1',name:'Sheet1',cells:{},merges:[],columnWidths:{},rowHeights:{}}]}; }
export function normalizeWorkbook(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.sheets) || !data.sheets.length || data.sheets.length>MAX_SHEETS) throw new Error(`Workbook must contain 1–${MAX_SHEETS} worksheets.`);
  let total=0; const ids=new Set(), names=new Set();
  const sheets=data.sheets.map((sheet,i)=> {
    if (!sheet || typeof sheet !== 'object' || !sheet.cells || typeof sheet.cells !== 'object' || Array.isArray(sheet.cells)) throw new Error('Invalid worksheet cells.');
    const id=typeof sheet.id==='string'&&sheet.id.length<=100&&sheet.id?sheet.id:`sheet-${i+1}`;
    const name=String(sheet.name || `Sheet${i+1}`).trim();
    if (!name||name.length>31||/[\\/?*\[\]:]/.test(name)||ids.has(id)||names.has(name.toLowerCase())) throw new Error('Worksheet names and IDs must be valid and unique.');
    ids.add(id); names.add(name.toLowerCase()); const cells={};
    for (const [ref,cell] of Object.entries(sheet.cells)) {
      const key=boundedAddress(ref);
      if (!cell || typeof cell !== 'object' || Array.isArray(cell)) throw new Error('Invalid cell data.');
      if (!['string','number','boolean'].includes(typeof cell.v) && cell.v != null) throw new Error('Invalid cell value.');
      if (typeof cell.v==='number'&&!Number.isFinite(cell.v)) throw new Error('Cell numbers must be finite.');
      const v=String(cell.v??'');
      if(v.length>32767) throw new Error('Cell text exceeds 32,767 characters.');
      const s=cleanStyle(cell.s);
      if(v!==''||Object.keys(s).length) { if(++total>MAX_CELLS) throw new Error(`Workbook supports at most ${MAX_CELLS.toLocaleString('en-US')} populated or styled cells.`); cells[key]={v,s}; }
    }
    if(sheet.merges!=null&&!Array.isArray(sheet.merges)) throw new Error('Invalid merged cells.');
    const merged=new Set();
    const merges=(sheet.merges||[]).map(merge=> {
      const start=typeof merge==='string'?merge.split(':')[0]:merge?.start, end=typeof merge==='string'?merge.split(':')[1]:merge?.end;
      const a=boundedAddress(start), b=boundedAddress(end);
      for(const ref of rangeAddresses(a,b)) { if(merged.has(ref)) throw new Error('Merged cells overlap.'); merged.add(ref); }
      return typeof merge==='string'?`${a}:${b}`:{start:a,end:b};
    });
    const dimensions=(source,limit,min,max)=> { const out={}; if(source&&typeof source==='object') for(const [key,value] of Object.entries(source)) { if(!/^\d+$/.test(key)||Number(key)>=limit||!Number.isFinite(value)) throw new Error('Invalid worksheet dimensions.'); out[Number(key)]=Math.max(min,Math.min(max,value)); } return out; };
    return {id,name,cells,merges,columnWidths:dimensions(sheet.columnWidths,MAX_COLS,40,600),rowHeights:dimensions(sheet.rowHeights,MAX_ROWS,20,300)};
  });
  return {name:String(data.name||'Untitled workbook').slice(0,150),active:ids.has(data.active)?data.active:sheets[0].id,sheets};
}
