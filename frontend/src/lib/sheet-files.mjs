import {normalizeWorkbook,evaluateCell,formatCell,colName,address,parseAddress,MAX_ROWS,MAX_COLS,MAX_SHEETS,MAX_CELLS} from './sheet-model.mjs';

const MIME={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',tsv:'text/tab-separated-values',json:'application/json',html:'text/html'};
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>ESC[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const xml=body=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+body;
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/package/2006/relationships';
const errorValue=v=>typeof v==='string'&&/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|CYCLE!|ERROR!)/.test(v);
const rgb=color=>(color||'#000000').replace('#','').toUpperCase();
const numeric=v=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(v).trim())&&Number.isFinite(Number(v));
const literal=v=>v.startsWith('=')||v.startsWith("'")||numeric(v)?"'"+v:v;

function extent(sheet){let rows=1,cols=1;for(const ref of Object.keys(sheet.cells)){const p=parseAddress(ref);rows=Math.max(rows,p.row+1);cols=Math.max(cols,p.col+1);}for(const merge of sheet.merges||[]){const end=typeof merge==='string'?merge.split(':')[1]:merge.end,p=parseAddress(end);rows=Math.max(rows,p.row+1);cols=Math.max(cols,p.col+1);}return {rows,cols};}
function numberCode(s){const zeros=(s.decimals??2)>0?'.'+'0'.repeat(s.decimals??2):'';return {general:'General',number:'#,##0'+zeros,currency:'"'+(s.currency||'INR')+' "#,##0'+zeros,percent:'0'+zeros+'%',date:'dd/mm/yyyy',time:'hh:mm:ss',scientific:'0'+zeros+'E+00'}[s.format||'general'];}
function styleXML(styles){
 const fonts=styles.map(s=>'<font><sz val="'+(s.fontSize||11)+'"/><name val="'+esc(s.fontFamily||'Arial')+'"/><color rgb="FF'+rgb(s.color)+'"/>'+(s.bold?'<b/>':'')+(s.italic?'<i/>':'')+(s.underline?'<u/>':'')+'</font>');
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...styles.map(s=>s.fill?'<fill><patternFill patternType="solid"><fgColor rgb="FF'+rgb(s.fill)+'"/><bgColor indexed="64"/></patternFill></fill>':'<fill><patternFill patternType="none"/></fill>')];
 const edge='<color rgb="FFD1D5DB"/>';
 const borders=styles.map(s=>'<border>'+['left','right','top','bottom'].map(side=>'<'+side+((s.border==='all'||s.border==='outside'||(s.border==='bottom'&&side==='bottom'))?' style="thin">'+edge+'</'+side+'>':'/>')).join('')+'<diagonal/></border>');
 const formats=styles.map((s,i)=>'<numFmt numFmtId="'+(164+i)+'" formatCode="'+esc(numberCode(s))+'"/>');
 const xfs=styles.map((s,i)=>'<xf numFmtId="'+(164+i)+'" fontId="'+i+'" fillId="'+(i+2)+'" borderId="'+i+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="'+(s.align||'left')+'" vertical="'+({middle:'center'}[s.valign]||s.valign||'bottom')+'" wrapText="'+(s.wrap?'1':'0')+'"/></xf>');
 return xml('<styleSheet xmlns="'+NS+'"><numFmts count="'+formats.length+'">'+formats.join('')+'</numFmts><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
}
async function xlsx(workbook){
 const {default:JSZip}=await import('jszip'),zip=new JSZip(),styles=[{}],styleIds=new Map([['{}',0]]);
 const sid=s=>{const key=JSON.stringify(s||{});if(!styleIds.has(key)){styleIds.set(key,styles.length);styles.push(s);}return styleIds.get(key);};
 zip.file('[Content_Types].xml',xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+workbook.sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'));
 zip.file('_rels/.rels',xml('<Relationships xmlns="'+REL+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'));
 zip.file('xl/workbook.xml',xml('<workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="'+Math.max(0,workbook.sheets.findIndex(s=>s.id===workbook.active))+'"/></bookViews><sheets>'+workbook.sheets.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'));
 zip.file('xl/_rels/workbook.xml.rels',xml('<Relationships xmlns="'+REL+'">'+workbook.sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'));
 for(const [i,sheet] of workbook.sheets.entries()){
  const rows=new Map();
  for(const [ref,cell] of Object.entries(sheet.cells)){
   const row=parseAddress(ref).row;let body='',type='',value=evaluateCell(sheet,ref,workbook.sheets),formula=cell.v.startsWith('=');
   if(formula){body='<f>'+esc(cell.v.slice(1))+'</f>';if(typeof value==='number')body+='<v>'+value+'</v>';else if(typeof value==='boolean'){type=' t="b"';body+='<v>'+(value?1:0)+'</v>';}else{type=errorValue(value)?' t="e"':' t="str"';body+='<v>'+esc(value)+'</v>';}}
   else if(/^(TRUE|FALSE)$/.test(cell.v)){type=' t="b"';body='<v>'+(cell.v==='TRUE'?1:0)+'</v>';}
   else if(numeric(cell.v)&&!cell.v.startsWith("'")){body='<v>'+Number(cell.v)+'</v>';}
   else{type=' t="inlineStr"';body='<is><t xml:space="preserve">'+esc(cell.v.startsWith("'")?cell.v.slice(1):cell.v)+'</t></is>';}
   if(!rows.has(row))rows.set(row,[]);rows.get(row).push({col:parseAddress(ref).col,xml:'<c r="'+ref+'" s="'+sid(cell.s)+'"'+type+'>'+body+'</c>'});
  }
  for(const row of Object.keys(sheet.rowHeights))if(!rows.has(Number(row)))rows.set(Number(row),[]);
  const data=[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([r,cells])=>'<row r="'+(r+1)+'"'+(sheet.rowHeights[r]?' ht="'+(sheet.rowHeights[r]*.75)+'" customHeight="1"':'')+'>'+cells.sort((a,b)=>a.col-b.col).map(c=>c.xml).join('')+'</row>').join('');
  const cols=Object.entries(sheet.columnWidths).map(([c,w])=>'<col min="'+(Number(c)+1)+'" max="'+(Number(c)+1)+'" width="'+Math.max(1,(w-5)/7)+'" customWidth="1"/>').join('');
  const merges=sheet.merges.map(m=>'<mergeCell ref="'+(typeof m==='string'?m:m.start+':'+m.end)+'"/>').join('');
  zip.file('xl/worksheets/sheet'+(i+1)+'.xml',xml('<worksheet xmlns="'+NS+'">'+(cols?'<cols>'+cols+'</cols>':'')+'<sheetData>'+data+'</sheetData>'+(merges?'<mergeCells count="'+sheet.merges.length+'">'+merges+'</mergeCells>':'')+'</worksheet>'));
 }
 zip.file('xl/styles.xml',styleXML(styles));return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
function delimited(workbook,separator){const sheet=workbook.sheets.find(s=>s.id===workbook.active)||workbook.sheets[0],{rows,cols}=extent(sheet);return '\ufeff'+Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{let value=String(evaluateCell(sheet,address(r,c),workbook.sheets)??'');if(/^[\s]*[=+@-]/.test(value)&&!numeric(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';}).join(separator)).join('\r\n');}
function css(s){return ['font-family:'+JSON.stringify(s.fontFamily||'Arial'),'font-size:'+(s.fontSize||11)+'pt','font-weight:'+(s.bold?'bold':'normal'),'font-style:'+(s.italic?'italic':'normal'),'text-decoration:'+(s.underline?'underline':'none'),'color:'+(s.color||'#111111'),'background:'+(s.fill||'#ffffff'),'text-align:'+(s.align||'left'),'vertical-align:'+(s.valign||'bottom'),'white-space:'+(s.wrap?'pre-wrap':'pre'),s.border==='bottom'?'border-bottom:1px solid #999':s.border&&s.border!=='none'?'border:1px solid #999':''].filter(Boolean).join(';');}
function html(workbook){return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(workbook.name)+'</title></head><body><h1>'+esc(workbook.name)+'</h1>'+workbook.sheets.map(sheet=>{const {rows,cols}=extent(sheet),covered=new Set(),merges=new Map();for(const raw of sheet.merges){const [a,b]=typeof raw==='string'?raw.split(':'):[raw.start,raw.end],start=parseAddress(a),end=parseAddress(b);merges.set(a,{rows:end.row-start.row+1,cols:end.col-start.col+1});for(let r=start.row;r<=end.row;r++)for(let c=start.col;c<=end.col;c++){const ref=address(r,c);if(ref!==a)covered.add(ref);}}return '<h2>'+esc(sheet.name)+'</h2><table style="border-collapse:collapse">'+Array.from({length:rows},(_,r)=>'<tr>'+Array.from({length:cols},(_,c)=>{const ref=address(r,c);if(covered.has(ref))return '';const cell=sheet.cells[ref],merge=merges.get(ref);return '<td'+(merge?' rowspan="'+merge.rows+'" colspan="'+merge.cols+'"':'')+' style="'+esc(css(cell?.s||{}))+'">'+esc(formatCell(evaluateCell(sheet,ref,workbook.sheets),cell?.s))+'</td>';}).join('')+'</tr>').join('')+'</table>';}).join('')+'</body></html>';}
export async function exportSheetFile(input,format='xlsx'){
 if(!MIME[format])throw Error('Choose XLSX, CSV, TSV, JSON or HTML.');const workbook=normalizeWorkbook(input),filename=workbook.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)||'workbook';
 const data=format==='xlsx'?await xlsx(workbook):format==='json'?JSON.stringify(workbook,null,2):format==='html'?html(workbook):delimited(workbook,format==='csv'?',':'\t');
 return {blob:new Blob([data],{type:MIME[format]}),filename:filename+'.'+format};
}

function parseDelimited(text,separator){
 const rows=[],row=[];let value='',quoted=false,populated=0;const push=()=>{if(value!==''&&++populated>MAX_CELLS)throw Error('Use at most '+MAX_CELLS.toLocaleString('en-US')+' populated cells.');if(value.length>32767)throw Error('Cell text exceeds 32,767 characters.');row.push(value);value='';if(row.length>MAX_COLS)throw Error('Use at most '+MAX_COLS+' columns.');};
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&(quoted||value==='')){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===separator)push();else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;push();rows.push([...row]);row.length=0;if(rows.length>MAX_ROWS)throw Error('Use at most '+MAX_ROWS+' rows.');}else value+=c;}
 if(quoted)throw Error('Unclosed quoted CSV field.');if(value||row.length){push();rows.push([...row]);}if(rows.length>MAX_ROWS)throw Error('Use at most '+MAX_ROWS+' rows.');return rows;
}
function zipBudget(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Invalid XLSX ZIP archive.');const entries=view.getUint16(end+10,true),central=view.getUint32(end+16,true);if(entries>1000||central===0xffffffff)throw Error('Workbook archive is too large.');
 let at=central,total=0;for(let i=0;i<entries;i++){if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Invalid workbook ZIP directory.');const size=view.getUint32(at+24,true);total+=size;if(size>8*1024*1024||total>30*1024*1024||view.getUint16(at+8,true)&1)throw Error('Workbook expands beyond the safe size limit or is encrypted.');at+=46+view.getUint16(at+28,true)+view.getUint16(at+30,true)+view.getUint16(at+32,true);}
}
const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
const first=(root,name)=>nodes(root,name)[0];
const content=(root,name)=>first(root,name)?.textContent||'';
function documentXML(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML entities are not supported.');const doc=new DOMParser().parseFromString(text,'application/xml');if(nodes(doc,'parsererror').length)throw Error('Invalid workbook XML.');return doc;}
function importedStyles(doc){
 if(!doc)return [{}];const list=name=>Array.from(first(doc,name)?.children||[]),fonts=list('fonts'),fills=list('fills'),borders=list('borders'),formats=new Map(nodes(doc,'numFmt').map(n=>[Number(n.getAttribute('numFmtId')),n.getAttribute('formatCode')]));
 const builtins={0:'General',1:'0',2:'0.00',3:'#,##0',4:'#,##0.00',9:'0%',10:'0.00%',11:'0.00E+00',14:'mm-dd-yy',20:'h:mm',21:'h:mm:ss',22:'m/d/yy h:mm'};
 const color=n=>{const raw=n?.getAttribute('rgb');return /^[0-9a-f]{8}$/i.test(raw||'')?'#'+raw.slice(2):undefined;};
 return list('cellXfs').map(xf=>{const s={},font=fonts[Number(xf.getAttribute('fontId'))],fill=fills[Number(xf.getAttribute('fillId'))],border=borders[Number(xf.getAttribute('borderId'))],align=first(xf,'alignment');if(font){for(const [tag,key] of [['b','bold'],['i','italic'],['u','underline']]){const node=first(font,tag);if(node&&node.getAttribute('val')!=='0'&&node.getAttribute('val')!=='false')s[key]=true;}s.fontFamily=first(font,'name')?.getAttribute('val');s.fontSize=Number(first(font,'sz')?.getAttribute('val'))||11;s.color=color(first(font,'color'));}if(fill&&first(fill,'patternFill')?.getAttribute('patternType')==='solid')s.fill=color(first(fill,'fgColor'));if(border){const edges=['left','right','top','bottom'].filter(side=>first(border,side)?.hasAttribute('style'));s.border=edges.length===4?'all':edges.includes('bottom')?'bottom':'none';}if(align){s.align=align.getAttribute('horizontal');s.valign=align.getAttribute('vertical')==='center'?'middle':align.getAttribute('vertical');s.wrap=align.getAttribute('wrapText')==='1'||align.getAttribute('wrapText')==='true';}const code=formats.get(Number(xf.getAttribute('numFmtId')))||builtins[Number(xf.getAttribute('numFmtId'))]||'General';s.format=code==='General'?'general':/E[+-]0/i.test(code)?'scientific':code.includes('%')?'percent':/h.*m/i.test(code)?'time':/[dy]/i.test(code.replace(/"[^"]*"/g,''))?'date':/\b[A-Z]{3}\b|[$€£₹]/.test(code)?'currency':'number';s.decimals=(/\.([0#]+)/.exec(code)?.[1]||'').length;s.currency=/"([A-Z]{3})/.exec(code)?.[1]||'INR';return s;});
}
export async function importSheetFile(file){
 if(!file||file.size>25*1024*1024)throw Error('Choose a file below 25 MB.');const extension=file.name.split('.').at(-1).toLowerCase(),name=file.name.replace(/\.[^.]+$/,'');
 if(!['xlsx','csv','tsv','json'].includes(extension))throw Error('Open XLSX, CSV, TSV or JSON. Legacy XLS files are not supported.');
 if(extension==='json')return normalizeWorkbook(JSON.parse(await file.text()));
 if(extension==='csv'||extension==='tsv'){
  const rows=parseDelimited((await file.text()).replace(/^\ufeff/,''),extension==='csv'?',':'\t'),cells={};rows.forEach((row,r)=>row.forEach((v,c)=>{if(v!=='')cells[address(r,c)]={v:/^[=+@]/.test(v)?"'"+v:v,s:{}};}));return normalizeWorkbook({name,active:'sheet-1',sheets:[{id:'sheet-1',name:'Sheet1',cells,merges:[],columnWidths:{},rowHeights:{}}]});
 }
 if(typeof DOMParser==='undefined')throw Error('XLSX import requires a browser with DOMParser.');
 const bytes=new Uint8Array(await file.arrayBuffer());zipBudget(bytes);const {default:JSZip}=await import('jszip'),zip=await JSZip.loadAsync(bytes);
 let expanded=0;
 const read=async path=>{const entry=zip.file(path);if(!entry)throw Error('Missing workbook part: '+path);const text=await new Promise((resolve,reject)=>{const chunks=[];let length=0,stopped=false;const stream=entry.internalStream('string');stream.on('data',chunk=>{if(stopped)return;length+=chunk.length;expanded+=chunk.length;if(length>8*1024*1024||expanded>30*1024*1024){stopped=true;stream.pause();reject(Error('Workbook expands beyond the safe size limit.'));return;}chunks.push(chunk);}).on('error',reject).on('end',()=>{if(!stopped)resolve(chunks.join(''));}).resume();});return documentXML(text);};
 const book=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels'),links=new Map(nodes(rels,'Relationship').map(n=>[n.getAttribute('Id'),n]));
 const sheetNodes=nodes(book,'sheet');if(!sheetNodes.length||sheetNodes.length>MAX_SHEETS)throw Error('Use 1–20 worksheets.');
 const styleRel=nodes(rels,'Relationship').find(n=>n.getAttribute('Type')?.endsWith('/styles')),sharedRel=nodes(rels,'Relationship').find(n=>n.getAttribute('Type')?.endsWith('/sharedStrings'));
 const pathFor=rel=>{if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('External workbook parts are not supported.');const target=rel.getAttribute('Target');if(!target||target.includes('..')||target.includes('\\')||/^[a-z]+:/i.test(target))throw Error('Unsupported workbook path.');return target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');};
 const styles=importedStyles(styleRel?await read(pathFor(styleRel)):null),strings=sharedRel?nodes(await read(pathFor(sharedRel)),'si').map(n=>nodes(n,'t').map(t=>t.textContent).join('')):[];
 let total=0;const sheets=[];
 for(const [i,node] of sheetNodes.entries()){
  const rel=links.get(node.getAttribute('r:id')||node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));if(!rel?.getAttribute('Type')?.endsWith('/worksheet'))throw Error('Only worksheets are supported.');const doc=await read(pathFor(rel)),cells={},columnWidths={},rowHeights={};
  for(const cell of nodes(doc,'c')){
   const ref=cell.getAttribute('r'),p=parseAddress(ref),formula=first(cell,'f'),type=cell.getAttribute('t');let value=content(cell,'v');
   if(formula){if(!formula.textContent)throw Error('Shared or array formulas must be expanded in Excel before import.');value='='+formula.textContent;}
   else if(type==='s'){const n=Number(value);if(!Number.isInteger(n)||strings[n]===undefined)throw Error('Invalid shared string index.');value=literal(strings[n]);}
   else if(type==='inlineStr')value=literal(nodes(cell,'t').map(n=>n.textContent).join(''));
   else if(type==='b')value=value==='1'?'TRUE':'FALSE';else if(type==='str')value=literal(value);
   if(p.row>=MAX_ROWS||p.col>=MAX_COLS){if(value!==''||formula)throw Error('Populated cell '+ref+' exceeds '+MAX_ROWS+' rows and '+MAX_COLS+' columns.');continue;}
   if(value===''&&!cell.hasAttribute('s'))continue;
   if(++total>MAX_CELLS)throw Error('Use at most '+MAX_CELLS.toLocaleString('en-US')+' populated or styled cells.');
   cells[ref]={v:value,s:styles[Number(cell.getAttribute('s'))]||{}};
  }
  // Excel often saves dimensions for entire columns/empty trailing rows. Clip only
  // this empty formatting; every nonempty cell outside the supported area rejects.
  for(const col of nodes(doc,'col')){const min=Number(col.getAttribute('min'))-1,max=Number(col.getAttribute('max'))-1;if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min)throw Error('Invalid column formatting.');if(min>=MAX_COLS||!col.hasAttribute('width'))continue;const width=Number(col.getAttribute('width'))*7+5;if(Number.isFinite(width)&&width>0)for(let c=min;c<=Math.min(MAX_COLS-1,max);c++)columnWidths[c]=width;}
  for(const row of nodes(doc,'row')){const r=Number(row.getAttribute('r'))-1;if(!Number.isInteger(r)||r<0)throw Error('Invalid row formatting.');if(r>=MAX_ROWS)continue;const height=Number(row.getAttribute('ht'))/.75;if(height>0)rowHeights[r]=height;}
  sheets.push({id:'sheet-'+(i+1),name:node.getAttribute('name'),cells,merges:nodes(doc,'mergeCell').map(n=>n.getAttribute('ref')),columnWidths,rowHeights});
 }
 const active=Number(first(book,'workbookView')?.getAttribute('activeTab'))||0;return normalizeWorkbook({name,active:sheets[active]?.id,sheets});
}
