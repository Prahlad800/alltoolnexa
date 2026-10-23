import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {importSheetFile,exportSheetFile} from '../src/lib/sheet-files.mjs';
import {normalizeWorkbook,MAX_ROWS,MAX_COLS,MAX_CELLS} from '../src/lib/sheet-model.mjs';

const sample=()=>normalizeWorkbook({name:'Accounts <2026>',active:'two',sheets:[{id:'one',name:'Sales & costs',cells:{A1:{v:'10',s:{bold:true,italic:true,underline:true,fontFamily:'Arial',fontSize:14,color:'#123456',fill:'#ffeedd',align:'right',valign:'middle',wrap:true,border:'all',format:'currency',currency:'INR',decimals:2}},B1:{v:'20',s:{}},C1:{v:'=SUM(A1:B1)',s:{format:'number'}},A2:{v:'<script>alert("x")</script>',s:{}},B2:{v:'TRUE',s:{}},A3:{v:'Merged',s:{}}},merges:['A3:C3'],columnWidths:{0:145},rowHeights:{0:32}},{id:'two',name:'Second',cells:{A1:{v:'hello, "world"\nnext',s:{}},B1:{v:"'=danger",s:{}},C1:{v:'-42',s:{}},A2:{v:'=SUM(1,2)',s:{}}},merges:[],columnWidths:{},rowHeights:{}}]});
test('XLSX export contains sheets, original formulas, typed numbers and booleans, merges and dimensions',async()=>{
 const {blob,filename}=await exportSheetFile(sample(),'xlsx');assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.equal(filename,'Accounts _2026_.xlsx');const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const workbook=await zip.file('xl/workbook.xml').async('string'),sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(workbook,/activeTab="1"/);assert.match(workbook,/Sales &amp; costs/);assert.match(sheet,/<f>SUM\(A1:B1\)<\/f><v>30<\/v>/);assert.match(sheet,/<c r="A1" s="\d+"><v>10<\/v>/);assert.match(sheet,/t="b"><v>1<\/v>/);assert.match(sheet,/<mergeCell ref="A3:C3"/);assert.match(sheet,/width="20"/);assert.match(sheet,/ht="24"/);assert.match(sheet,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
 const styles=await zip.file('xl/styles.xml').async('string');for(const token of ['<b/>','<i/>','<u/>','FF123456','FFFFEEDD','wrapText="1"','vertical="center"','style="thin"','INR','fontId=','numFmtId='])assert.ok(styles.includes(token),token);
});
test('CSV/TSV exports active sheet calculated values, quotes multiline fields and protects dangerous text',async()=>{
 const csv=await exportSheetFile(sample(),'csv'),text=await csv.blob.text();assert.match(text,/"hello, ""world""\nnext"/);assert.match(text,/"'=danger"/);assert.match(text,/"-42"/);assert.match(text,/"3"/);assert.ok(!text.includes('=SUM'));const tsv=await exportSheetFile(sample(),'tsv');assert.ok((await tsv.blob.text()).includes('\t'));
});
test('JSON round trip preserves full supported workbook state and HTML escapes executable strings',async()=>{
 const workbook=sample(),saved=await exportSheetFile(workbook,'json'),loaded=await importSheetFile(new File([await saved.blob.text()],'saved.json'));assert.deepEqual(loaded,workbook);
 const output=await exportSheetFile(workbook,'html'),text=await output.blob.text();assert.match(text,/&lt;script&gt;/);assert.ok(!text.includes('<script>'));assert.match(text,/colspan="3"/);assert.match(text,/background:#ffeedd/);assert.match(text,/font-weight:bold/);assert.match(text,/Accounts &lt;2026&gt;/);
});
test('delimited import supports BOM, multiline quoted text and escaped quotes as literal cell values',async()=>{
 const csv='\ufeff"a,b","line1\nline2","say ""hi"""\r\n=SUM(1),-4,42\r\n';const wb=await importSheetFile(new File([csv],'import.csv'));assert.equal(wb.sheets[0].cells.A1.v,'a,b');assert.equal(wb.sheets[0].cells.B1.v,'line1\nline2');assert.equal(wb.sheets[0].cells.C1.v,'say "hi"');assert.equal(wb.sheets[0].cells.A2.v,"'=SUM(1)");assert.equal(wb.sheets[0].cells.B2.v,'-4');
});
test('imports reject unsupported legacy formats, oversized and out-of-bounds files',async()=>{
 await assert.rejects(importSheetFile(new File(['x'],'old.xls')),/Legacy XLS/);await assert.rejects(importSheetFile({name:'huge.csv',size:26*1024*1024}),/25 MB/);await assert.rejects(importSheetFile(new File(['x,'.repeat(MAX_COLS+1)],'wide.csv')),new RegExp(MAX_COLS+' columns'));await assert.rejects(importSheetFile(new File(['x\n'.repeat(MAX_ROWS+1)],'long.csv')),new RegExp(MAX_ROWS+' rows'));await assert.rejects(importSheetFile(new File(['"open'],'bad.csv')),/Unclosed/);
});

test('CSV imports and roundtrips 201 and 1000 rows without truncating their last cells',async()=>{
 for(const count of [201,1000]){
  const csv=Array.from({length:count},(_,i)=>`record-${i+1},${i+1}`).join('\n');
  const book=await importSheetFile(new File([csv],'large.csv'));
  assert.equal(Object.keys(book.sheets[0].cells).length,count*2);assert.equal(book.sheets[0].cells['A'+count].v,'record-'+count);assert.equal(book.sheets[0].cells['B'+count].v,String(count));
  const {blob}=await exportSheetFile(book,'csv'),reopened=await importSheetFile(new File([blob],'reopened.csv'));assert.deepEqual(reopened.sheets[0].cells,book.sheets[0].cells);
  const xlsx=await exportSheetFile(book,'xlsx'),zip=await JSZip.loadAsync(await xlsx.blob.arrayBuffer()),sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(sheet,new RegExp('<row r="'+count+'">'));assert.match(sheet,new RegExp('<c r="B'+count+'"[^>]*><v>'+count+'</v>'));
 }
});

test('CSV rejects populated-cell budget excess before constructing a workbook',async()=>{
 const row=Array.from({length:MAX_COLS},()=>'x').join(','),csv=Array.from({length:Math.floor(MAX_CELLS/MAX_COLS)+1},()=>row).join('\n');
 await assert.rejects(importSheetFile(new File([csv],'dense.csv')),/populated cells/);
});

test('browser DOMParser imports real XLSX styles, formulas, dimensions and shared strings',{skip:process.env.SHEET_BROWSER_TEST!=='1'},async()=>{
 const {chromium}=await import('@playwright/test'),{readFileSync}=await import('node:fs');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.addScriptTag({path:'node_modules/jszip/dist/jszip.min.js'});
  const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
  const model=data(readFileSync('src/lib/sheet-model.mjs','utf8')),zip=data('export default globalThis.JSZip;');
  // Resolve the production module's two imports to actual installed code in the test browser.
  await page.addScriptTag({type:'importmap',content:JSON.stringify({imports:{jszip:zip}})});
  const source=data(readFileSync('src/lib/sheet-files.mjs','utf8').replace("'./sheet-model.mjs'",JSON.stringify(model)));
  const result=await page.evaluate(async ({source,book})=>{
   const {exportSheetFile,importSheetFile}=await import(source);
   book.sheets[0].cells.A1.s.currency='USD';book.sheets[0].cells.B2={v:"'00123",s:{}};
   const {blob}=await exportSheetFile(book,'xlsx'),roundtrip=await importSheetFile(new File([blob],'roundtrip.xlsx'));
   const archive=await globalThis.JSZip.loadAsync(await blob.arrayBuffer());
   const rels=await archive.file('xl/_rels/workbook.xml.rels').async('string');
   archive.file('xl/_rels/workbook.xml.rels',rels.replace('</Relationships>','<Relationship Id="strings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'));
   archive.file('xl/sharedStrings.xml','<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><t>Shared </t></r><r><t>text</t></r></si></sst>');
   const sheet=await archive.file('xl/worksheets/sheet1.xml').async('string');
   archive.file('xl/worksheets/sheet1.xml',sheet.replace('</sheetData>','<row r="4"><c r="A4" t="s"><v>0</v></c></row></sheetData>'));
   const withShared=await importSheetFile(new File([await archive.generateAsync({type:'uint8array'})],'shared.xlsx'));
   const originalSheet=await archive.file('xl/worksheets/sheet1.xml').async('string');
   archive.file('xl/worksheets/sheet1.xml',originalSheet.replace('<sheetData>','<cols><col min="1" max="16384" width="20"/></cols><sheetData>').replace('</sheetData>','<row r="10001" ht="25"><c r="A10001" s="0"/></row><row r="1048576"><c r="XFD1048576" s="0"/></row></sheetData>'));
   const clipped=await importSheetFile(new File([await archive.generateAsync({type:'uint8array'})],'formatting.xlsx'));
   if(clipped.sheets[0].cells.A10001||clipped.sheets[0].cells.XFD1048576||Object.keys(clipped.sheets[0].columnWidths).length!==256)throw Error('Empty trailing formatting was not safely clipped.');
   archive.file('xl/worksheets/sheet1.xml',originalSheet.replace('</sheetData>','<row r="10001"><c r="A10001"><v>99</v></c></row></sheetData>'));
   let rejected=false;try{await importSheetFile(new File([await archive.generateAsync({type:'uint8array'})],'outside.xlsx'));}catch(e){rejected=/Populated cell A10001/.test(e.message);}if(!rejected)throw Error('Populated out-of-bounds cell must never be silently discarded.');
   const large=await importSheetFile(new File([Array.from({length:1000},(_,i)=>`item-${i+1},${i+1}`).join('\n')],'large.csv'));
   large.sheets[0].cells.C1000={v:'=SUM(B1:B1000)',s:{bold:true}};
   const exported=await exportSheetFile(large,'xlsx'),reopened=await importSheetFile(new File([exported.blob],'large.xlsx'));
   return {roundtrip,shared:withShared.sheets[0].cells.A4.v,largeCells:Object.keys(reopened.sheets[0].cells).length,last:reopened.sheets[0].cells.A1000.v,largeFormula:reopened.sheets[0].cells.C1000};
  },{source,book:sample()});
  const sheet=result.roundtrip.sheets[0];assert.equal(result.roundtrip.sheets.length,2);assert.equal(result.roundtrip.active,'sheet-2');assert.equal(sheet.cells.C1.v,'=SUM(A1:B1)');assert.equal(sheet.cells.B2.v,"'00123");assert.equal(sheet.cells.A1.s.currency,'USD');assert.equal(sheet.cells.A1.s.format,'currency');assert.equal(sheet.cells.A1.s.bold,true);assert.equal(sheet.cells.A1.s.fill.toLowerCase(),'#ffeedd');assert.equal(sheet.columnWidths[0],145);assert.equal(sheet.rowHeights[0],32);assert.deepEqual(sheet.merges,['A3:C3']);assert.equal(result.shared,'Shared text');assert.equal(result.largeCells,2001);assert.equal(result.last,'item-1000');assert.equal(result.largeFormula.v,'=SUM(B1:B1000)');assert.equal(result.largeFormula.s.bold,true);
 }finally{await browser.close();}
});
