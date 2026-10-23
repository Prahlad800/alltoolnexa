import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';

const enabled=process.env.SHEET_UI_TEST==='1';
const URL=process.env.SHEET_UI_URL||'http://127.0.0.1:3000/tools/spreadsheet-editor';
async function setup(viewport){
 const {chromium,expect}=await import('@playwright/test');
 const browser=await chromium.launch({channel:process.env.SHEET_UI_BROWSER||'chrome',headless:true});
 const context=await browser.newContext({viewport,acceptDownloads:true});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new globalThis.URL(URL).origin});
 const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());
 await page.goto(URL,{timeout:180000});
 const editor=page.getByRole('region',{name:'Spreadsheet workspace'});
 await expect(editor.getByRole('button',{name:'Load sample',exact:true})).toBeVisible({timeout:90000});
 await editor.getByRole('button',{name:'Load sample',exact:true}).click();
 const cell=ref=>editor.locator(`[data-address="${ref}"]`);
 await expect(cell('D5')).toContainText('12,350');
 if(viewport.width===1440)await editor.screenshot({path:'runtime-results/spreadsheet-editor.png'});
 return {browser,page,editor,cell,expect};
}

test('spreadsheet browser editing, undo, shortcuts, formula bar, TSV clipboard and XLSX UI roundtrip',{skip:!enabled,timeout:240000},async()=>{
 const {browser,page,editor,cell,expect}=await setup({width:1440,height:1000});
 try{
  await cell('B2').dblclick();await editor.getByRole('textbox',{name:'Edit B2',exact:true}).fill('6');await editor.getByRole('textbox',{name:'Edit B2',exact:true}).press('Enter');
  await expect(cell('D5')).toContainText('14,850');
  await editor.getByRole('button',{name:'Undo',exact:true}).click();await expect(cell('B2')).toHaveText('4');await expect(cell('D5')).toContainText('12,350');
  await cell('A2').click();await expect(cell('A2')).toBeFocused();await page.keyboard.press('Control+b');await expect(editor.getByRole('tabpanel',{name:'Home controls'}).getByRole('button',{name:'B',exact:true})).toHaveAttribute('aria-pressed','true');await expect(cell('A2')).toHaveCSS('font-weight','700');await page.keyboard.press('Control+b');await expect(editor.getByRole('tabpanel',{name:'Home controls'}).getByRole('button',{name:'B',exact:true})).toHaveAttribute('aria-pressed','false');
  await cell('E2').click();const formula=editor.getByRole('textbox',{name:'Formula or value',exact:true});await formula.fill('=SUM(2,3)');await formula.press('Enter');await expect(cell('E2')).toHaveText('5');
  await cell('F2').click();await page.evaluate(()=>navigator.clipboard.writeText('7\t8\n9\t10'));await editor.getByRole('button',{name:'Paste',exact:true}).click();await expect(cell('F2')).toHaveText('7');await expect(cell('G3')).toHaveText('10');
  await cell('F2').click();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown');await editor.getByRole('button',{name:'Copy',exact:true}).click();await expect(editor.getByRole('status')).toContainText('Copied cells.');const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(copied.replaceAll('\r\n','\n'),'7\t8\n9\t10');
  await cell('I2').click();await editor.getByRole('button',{name:'Paste',exact:true}).click();await expect(cell('I2')).toHaveText('7');await expect(cell('J3')).toHaveText('10');
  await editor.getByRole('combobox',{name:'Export format',exact:true}).selectOption('xlsx');
  const pending=page.waitForEvent('download',{timeout:30000});await editor.getByRole('button',{name:'Download',exact:true}).click();const download=await pending,bytes=await readFile(await download.path());assert.match(download.suggestedFilename(),/\.xlsx$/);
  const zip=await JSZip.loadAsync(bytes),sheetXML=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(sheetXML,/<f>SUM\(2,3\)<\/f>/);assert.match(sheetXML,/<f>SUM\(D2:D4\)<\/f>/);assert.match(sheetXML,/<v>12350<\/v>/);
  await editor.locator('input[type="file"]').setInputFiles({name:'roundtrip.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});await expect(editor.getByRole('status')).toContainText('Workbook opened.',{timeout:30000});await expect(cell('D5')).toContainText('12,350');await expect(cell('E2')).toHaveText('5');await expect(cell('I2')).toHaveText('7');await expect(cell('J3')).toHaveText('10');
  await cell('E2').click();await expect(formula).toHaveValue('=SUM(2,3)');await expect(editor.getByRole('alert')).toHaveCount(0);
 }finally{await browser.close();}
});

test('spreadsheet mobile keeps page within viewport with a separately scrollable grid',{skip:!enabled,timeout:180000},async()=>{
 const {browser,page,editor,cell,expect}=await setup({width:390,height:844});
 try{
  await expect(cell('A2')).toHaveText('Design');
  const geometry=await editor.evaluate(el=>{const table=el.querySelector('[role="grid"]'),viewport=table.parentElement;return {pageWidth:document.documentElement.scrollWidth,windowWidth:window.innerWidth,editorWidth:el.getBoundingClientRect().width,gridWidth:viewport.clientWidth,gridScrollWidth:viewport.scrollWidth};});
  assert.ok(geometry.pageWidth<=geometry.windowWidth+2,JSON.stringify(geometry));assert.ok(geometry.editorWidth<=390,JSON.stringify(geometry));assert.ok(geometry.gridScrollWidth>geometry.gridWidth,'Wide grid must scroll inside its own container');
  await editor.getByRole('tab',{name:'Shortcuts',exact:true}).click();await expect(editor.getByRole('tabpanel',{name:'Shortcuts controls'})).toContainText('Undo / redo');await expect(editor.getByRole('button',{name:'Download',exact:true})).toBeVisible();
  await page.setViewportSize({width:768,height:1024});await expect(cell('D5')).toContainText('12,350');
 }finally{await browser.close();}
});

test('spreadsheet opens 1000-row CSV and navigates to row800 with at most102 DOM rows',{skip:!enabled,timeout:180000},async()=>{
 const {browser,editor,cell,expect}=await setup({width:1440,height:1000});
 try{
  const csv=Array.from({length:1000},(_,i)=>`item-${i+1},${i+1}`).join('\n');
  await editor.locator('input[type="file"]').setInputFiles({name:'1000-rows.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(editor.getByRole('status')).toContainText('Workbook opened.',{timeout:30000});await expect(cell('A1')).toHaveText('item-1');
  const addressBox=editor.getByRole('textbox',{name:'Cell address',exact:true});await addressBox.fill('A800');await addressBox.press('Enter');
  await expect(cell('A800')).toHaveText('item-800');await expect(cell('B800')).toHaveText('800');
  const grid=editor.getByRole('grid');assert.ok(await grid.locator('tr').count()<=102);await expect(grid).toHaveAttribute('aria-rowcount','1001');
  await editor.screenshot({path:'runtime-results/spreadsheet-large-import.png'});
  await addressBox.fill('A1000');await addressBox.press('Enter');await expect(cell('A1000')).toHaveText('item-1000');await expect(editor.getByRole('alert')).toHaveCount(0);
 }finally{await browser.close();}
});
