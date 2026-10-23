import test from 'node:test';
import assert from 'node:assert/strict';
import {colName,parseAddress,address,rangeAddresses,evaluateCell,shiftFormula,adjustReferences,formatCell,normalizeWorkbook,createWorkbook,SUPPORTED_FUNCTIONS,MAX_ROWS,MAX_COLS,MAX_CELLS,MAX_FORMULA_RANGE_CELLS} from '../src/lib/sheet-model.mjs';

function sheet(values,name='Sheet1') { return {id:name,name,cells:Object.fromEntries(Object.entries(values).map(([ref,v])=>[ref,{v:String(v)}]))}; }
function result(formula,values={}) { return evaluateCell(sheet({...values,Z99:formula}),'Z99'); }

test('cell addressing round trips and rejects malformed addresses',()=> {
  assert.equal(colName(0),'A'); assert.equal(colName(25),'Z'); assert.equal(colName(26),'AA'); assert.equal(colName(51),'AZ');
  assert.deepEqual(parseAddress('$a$12'),{row:11,col:0}); assert.equal(address(MAX_ROWS-1,MAX_COLS-1),'IV10000');
  for(const invalid of ['A0','A-1','A1<script>','XFE1','A1048577','1A']) assert.throws(()=>parseAddress(invalid));
  assert.deepEqual(rangeAddresses('B2','A1'),['A1','B1','A2','B2']);
  assert.throws(()=>rangeAddresses('A1','ZZ999'));
});
test('arithmetic precedence, comparisons, strings, percent and negative powers',()=> {
  assert.equal(result('=2+3*4'),14); assert.equal(result('=(2+3)*4'),20);
  assert.equal(result('=2^3^2'),512); assert.equal(result('=-2^2'),-4);
  assert.equal(result('=50%*10'),5); assert.equal(result('=1e2+0.5'),100.5);
  assert.equal(result('="Hello "&UPPER("world")'),'Hello WORLD');
  assert.equal(result('="a"="A"'),true); assert.equal(result('=5<>6'),true);
  assert.equal(result('="He said ""hi"""'),'He said "hi"');
});
test('references and ranges recalculate and ignore nonnumeric text in aggregations',()=> {
  const values={A1:2,A2:4,A3:'hello',A4:"'12",B1:'=SUM(A1:A4)',B2:'=B1*2'};
  assert.equal(result('=B2',values),12);
  for(const [formula,expected] of [['=SUM(A1:A4)',6],['=AVERAGE(A1:A4)',3],['=MIN(A1:A4)',2],['=MAX(A1:A4)',4],['=COUNT(A1:A4)',2],['=COUNTA(A1:A4)',4]]) assert.equal(result(formula,values),expected,formula);
  assert.equal(evaluateCell(sheet({A1:"'=SUM(1,2)"}),'A1'),'=SUM(1,2)');
  assert.equal(result('=A10+3'),3);
});
test('IF and IFERROR evaluate only selected branches',()=> {
  assert.equal(result('=IF(TRUE,42,1/0)'),42); assert.equal(result('=IF(FALSE,1/0,7)'),7);
  assert.equal(result('=IFERROR(1/0,"safe")'),'safe'); assert.equal(result('=IFERROR(8,1/0)'),8);
  assert.equal(result('=IF(FALSE,1)'),false); assert.equal(result('=AND(TRUE,NOT(FALSE),1)'),true);
  assert.equal(result('=OR(FALSE,0,TRUE)'),true);
});
test('text, rounding and conditional range functions',()=> {
  const cases=[['=ROUND(-1.25,1)',-1.3],['=ABS(-42)',42],['=LEFT("hello",2)','he'],['=RIGHT("hello",0)',''],['=LEN("hello")',5],['=TRIM("  hello   world  ")','hello world'],['=LOWER("HI")','hi'],['=CONCAT("a","b",3)','ab3']];
  for(const [formula,expected] of cases) assert.equal(result(formula),expected,formula);
  const values={A1:'Apple',A2:'Pear',A3:'Apricot',B1:3,B2:5,B3:8};
  assert.equal(result('=COUNTIF(A1:A3,"A*")',values),2);
  assert.equal(result('=SUMIF(A1:A3,"A*",B1:B3)',values),11);
  assert.equal(result('=SUMIF(B1:B3,">4")',values),13);
  assert.equal(result('=COUNTIF(A1:A3,"<>Pear")',values),2);
  assert.equal(result('=COUNTIF(A1:A3,">2")',values),0);
  assert.equal(result('=COUNTIF(A1:A3,"A?ple")',values),1);
  assert.equal(result('=COUNTIF(A1:A3,"a~*")',{A1:'a*',A2:'apple',A3:'pear'}),1);
});
test('cross sheet references support quoted names and case insensitivity',()=> {
  const first=sheet({A1:"='Sales data'!A1+Sheet2!B1"}), second=sheet({A1:7},'Sales data'), third=sheet({B1:3},'Sheet2');
  assert.equal(evaluateCell(first,'A1',[first,second,third]),10);
  first.cells.A1.v="=SUM('sales DATA'!A1:A2)";
  assert.equal(evaluateCell(first,'A1',{sheets:[first,second,third]}),7);
  first.cells.A1.v='=Missing!A1'; assert.equal(evaluateCell(first,'A1',[first]),'#REF!');
});
test('invalid and cyclic formulas return stable errors without code execution',()=> {
  assert.equal(result('=1/0'),'#DIV/0!'); assert.equal(result(`=A${MAX_ROWS+1}`),'#REF!');
  assert.equal(result('=SUM(A1:ZZ999)'),'#REF!'); assert.equal(result('=BOGUS(1)'),'#NAME?');
  assert.equal(result('=SUM(#REF!:A3)'),'#REF!'); assert.equal(result('=SUM(A1:#REF!)'),'#REF!');
  assert.equal(result('=IF(TRUE,1,SUM(#REF!:A3))'),1);
  assert.equal(result('=1+'),'#ERROR!'); assert.equal(result('="x"+2'),'#VALUE!');
  assert.equal(result('=AVERAGE(A1:A3)'),'#DIV/0!'); assert.equal(result('=LEFT("a",-1)'),'#VALUE!');
  assert.equal(result('=globalThis.process.exit()'),'#NAME?');
  assert.equal(result('=A1',{A1:'=A2',A2:'=A1'}),'#CYCLE!');
  assert.equal(result('=IFERROR(A1,"loop")',{A1:'=A1'}),'loop');
  assert.equal(result('='+ '('.repeat(200)+'1'+')'.repeat(200)),'#ERROR!');
  assert.ok(SUPPORTED_FUNCTIONS.includes('SUMIF'));
});
test('formula shifting honors absolute axes, strings, function names and sheet names',()=> {
  assert.equal(shiftFormula('=SUM(A1:B2)+$C3+D$4+$E$5',1,2),'=SUM(C2:D3)+$C4+F$4+$E$5');
  assert.equal(shiftFormula('="A1"&A1',1,1),'="A1"&B2');
  assert.equal(shiftFormula("='Sheet 1'!A1+Sheet2!$B1",1,1),"='Sheet 1'!B2+Sheet2!$B2");
  assert.equal(shiftFormula('=A1',-1,0),'=#REF!'); assert.equal(shiftFormula('=LOG10(A1)',1,0),'=LOG10(A2)');
  assert.equal(shiftFormula('hello',1,1),'hello');
});
test('cell formatting covers numbers, percentages, currency, dates and booleans',()=> {
  assert.equal(formatCell(1234.5,{format:'number'}),'1,234.50');
  assert.equal(formatCell(.125,{format:'percent',decimals:1}),'12.5%');
  assert.equal(formatCell(12,{format:'currency',currency:'USD'}),'$12.00');
  assert.equal(formatCell(45000,{format:'date'}),'15/03/2023');
  assert.equal(formatCell(.5,{format:'time'}),'12:00:00');
  assert.equal(formatCell(1200,{format:'scientific',decimals:1}),'1.2e+3');
  assert.equal(formatCell(true),'TRUE'); assert.equal(formatCell('#REF!'),'#REF!');
});
test('structural edits adjust only the changed sheet and preserve absolute axes',()=> {
  assert.equal(adjustReferences('=A1+$B$2+C3','row',1,1,'Sheet1','Sheet1'),'=A1+$B$3+C4');
  assert.equal(adjustReferences('=A1+$B$2+C3','col',1,-1,'Sheet1','Sheet1'),'=A1+#REF!+B3');
  assert.equal(adjustReferences('=A1+Sheet1!B2+Other!C3','row',1,1,'Sheet1','Other'),'=A1+Sheet1!B3+Other!C3');
  assert.equal(adjustReferences('=SUM(Other!A1:B3)+SUM(A1:B3)','row',1,1,'Sheet1','Sheet1'),'=SUM(Other!A1:B3)+SUM(A1:B4)');
  assert.equal(adjustReferences('=SUM(Sheet1!A1:B3)','row',1,1,'Sheet1','Other'),'=SUM(Sheet1!A1:B4)');
  assert.equal(adjustReferences('="A2"&\'Sales data\'!A2','row',1,1,'Sales data','Other'),'="A2"&\'Sales data\'!A3');
  assert.equal(adjustReferences('=A2+A3+A4','row',1,-2,'Sheet1','Sheet1'),'=#REF!+#REF!+A2');
});
test('workbook normalization cleans styles and validates unsupported content',()=> {
  const book=createWorkbook(); book.sheets[0].cells.A1={v:123,s:{bold:true,color:'#123456',fill:'url(javascript:bad)',fontSize:100,format:'percent',injected:'bad'}};
  const normalized=normalizeWorkbook(book);
  assert.deepEqual(normalized.sheets[0].cells.A1,{v:'123',s:{bold:true,color:'#123456',fontSize:72,format:'percent'}});
  assert.throws(()=>normalizeWorkbook({sheets:[]}));
  const outOfBounds=createWorkbook(); outOfBounds.sheets[0].cells[address(0,MAX_COLS)]={v:'x'}; assert.throws(()=>normalizeWorkbook(outOfBounds));
  const duplicate=createWorkbook(); duplicate.sheets.push({...duplicate.sheets[0]}); assert.throws(()=>normalizeWorkbook(duplicate));
  const overlap=createWorkbook(); overlap.sheets[0].merges=['A1:B2','B2:C3']; assert.throws(()=>normalizeWorkbook(overlap));
  const merged=createWorkbook(); merged.sheets[0].merges=[{start:'A1',end:'B2'}]; assert.deepEqual(normalizeWorkbook(merged).sheets[0].merges,[{start:'A1',end:'B2'}]);
});
test('large imported worksheets preserve rows beyond the previous 200-row limit',()=> {
  const workbook=createWorkbook();
  for(let row=0;row<800;row++) workbook.sheets[0].cells[address(row,0)]={v:String(row+1),s:{format:'number'}};
  workbook.sheets[0].cells.IV10000={v:'last supported cell'};
  workbook.sheets[0].rowHeights[799]=36;
  workbook.sheets[0].columnWidths[255]=120;
  const normalized=normalizeWorkbook(workbook);
  assert.equal(Object.keys(normalized.sheets[0].cells).length,801);
  assert.equal(normalized.sheets[0].cells.A201.v,'201');
  assert.equal(normalized.sheets[0].cells.A800.v,'800');
  assert.equal(normalized.sheets[0].rowHeights[799],36);
  assert.equal(normalized.sheets[0].columnWidths[255],120);
  assert.equal(evaluateCell(normalized.sheets[0],'IV10000'),'last supported cell');
  assert.equal(evaluateCell(sheet({A201:'201',A800:'800',B1:'=A201+A800'}),'B1'),1001);
  assert.equal(shiftFormula('=A200',1,0),'=A201');
  assert.equal(adjustReferences('=A200','row',199,1,'Sheet1','Sheet1'),'=A201');
  assert.equal(shiftFormula('=IV10000',1,0),'=#REF!');
  assert.equal(adjustReferences('=IV10000','row',9999,1,'Sheet1','Sheet1'),'=#REF!');
});
test('editing capacity and formula evaluation have independent limits',()=> {
  assert.equal(MAX_CELLS,100000); assert.equal(MAX_FORMULA_RANGE_CELLS,10000);
  assert.equal(rangeAddresses('A1','J10000').length,MAX_CELLS);
  assert.throws(()=>rangeAddresses('A1','K10000'),/100,000/);
  assert.equal(result('=SUM(A1:A10000)',{A201:'4',A10000:'5'}),9);
  assert.equal(result('=SUM(A1:B10000)'), '#NUM!');
  assert.equal(result('=SUM(A1:IV10000)'), '#NUM!');
  assert.equal(result('=SUM(A1:A10001)'), '#REF!');
  const beyond=createWorkbook(); beyond.sheets[0].cells.A10001={v:'x'};
  assert.throws(()=>normalizeWorkbook(beyond),/10,000 rows and 256 columns/);
});
test('normalization enforces the enlarged populated-cell capacity across worksheets',()=> {
  const workbook=createWorkbook();
  for(let row=0;row<10000;row++) for(let col=0;col<10;col++) workbook.sheets[0].cells[address(row,col)]={v:'1'};
  assert.equal(Object.keys(normalizeWorkbook(workbook).sheets[0].cells).length,MAX_CELLS);
  workbook.sheets.push({id:'second',name:'Sheet2',cells:{A1:{v:'extra'}},merges:[],rowHeights:{},columnWidths:{}});
  assert.throws(()=>normalizeWorkbook(workbook),/100,000 populated or styled cells/);
});
