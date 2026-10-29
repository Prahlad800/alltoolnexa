import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import JSZip from 'jszip';
import {PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
import {parseMarkdown,inlineText} from '../shared/markdown-workspace.mjs';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3106',out='runtime-results/markdown-editor';
const widths=process.env.AUDIT_WIDTHS?process.env.AUDIT_WIDTHS.split(',').map(Number):[320,390,1440];
const source='# Conversion Check\n\n**Bold words**, *italic* and [a link](https://example.com).\n\n## Plan\n\n1. First\n2. Second\n\n| Task | Status |\n| --- | --- |\n| Export | Ready |\n\n```js\nconsole.log("hello");\n```\n\nनमस्ते दुनिया';
await mkdir(out,{recursive:true});const checks=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
function verifyPDF(bytes,multiple=false){
 return PDFDocument.load(bytes).then(pdf=>{
  assert.ok(pdf.getPageCount()>=(multiple?2:1));let images=0,dark=0;
  for(const [,object] of pdf.context.enumerateIndirectObjects())if(object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))?.toString()==='/Image'&&object.dict.get(PDFName.of('ColorSpace'))?.toString()==='/DeviceRGB'){
   const pixels=inflateSync(object.getContents());let white=0,ink=0;for(const value of pixels){if(value>245)white++;if(value<220)ink++;}
   assert.ok(ink>30,'PDF page image must contain document marks');assert.ok(white>pixels.length*.5,'PDF page must have a white paper background');dark+=ink;images++;
  }
  assert.ok(images>=pdf.getPageCount());assert.ok(dark>1000,'PDF must contain visible rendered content');return pdf;
 });
}
try{
 for(const width of widths){
  console.log(`Checking Markdown workspace at ${width}px`);
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<768,hasTouch:width<768,acceptDownloads:true});
  await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('alltoolnexa-language','en');});
  const page=await context.newPage(),errors=[];let trackingRequests=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.url().includes('tracker.invalid'))trackingRequests++;});
  await page.goto(origin+'/markdown-editor',{waitUntil:'load'});
  const studio=page.getByRole('region',{name:'Markdown studio',exact:true}),editor=studio.getByRole('textbox',{name:'Markdown source',exact:true}),preview=studio.getByRole('article',{name:'Rendered Markdown'}),format=studio.getByRole('combobox',{name:'Export format'});
  const edit=async text=>{if(width<768)await studio.getByRole('tab',{name:'Editor',exact:true}).click();await editor.fill(text);};
  const showPreview=async()=>{if(width<768)await studio.getByRole('tab',{name:'Preview',exact:true}).click();};
  await expect(editor).toBeEnabled();await edit(source);await showPreview();
  await expect(preview.getByRole('heading',{name:'Conversion Check'})).toBeVisible();await expect(preview.locator('table')).toHaveCount(1);await expect(preview.locator('pre')).toContainText('console.log');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  checks.push({width,check:'live Markdown preview, GFM table/code/outline and responsive geometry',passed:true});
  await edit('hello');await editor.evaluate(element=>element.setSelectionRange(0,5));await studio.getByRole('button',{name:'Bold',exact:true}).click();await expect(editor).toHaveValue('**hello**');
  await edit(source);await studio.getByRole('textbox',{name:'Document name',exact:true}).fill('conversion');
  let docxBytes;
  for(const id of ['md','docx','html','txt','rtf','pdf']){
   console.log(`Checking ${width}px ${id} export`);await format.selectOption(id);
   const pending=page.waitForEvent('download',{timeout:60000});await studio.getByRole('button',{name:'Convert & download',exact:true}).click();const file=await pending,bytes=await readFile(await file.path());
   assert.equal(file.suggestedFilename(),'conversion.'+id);assert.ok(bytes.length>20);
   if(id==='md')assert.equal(bytes.toString(),source);
   if(id==='docx'){docxBytes=bytes;const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string');for(const token of ['Heading1','<w:tbl>','Bold words','नमस्ते','Consolas'])assert.ok(xml.includes(token),token);}
   if(id==='html'){assert.ok(bytes.toString().includes('<table>'));assert.ok(bytes.toString().includes("script-src 'none'"));}
   if(id==='txt'){assert.ok(bytes.toString().includes('Bold words'));assert.ok(!bytes.toString().includes('**Bold words**'));assert.ok(bytes.toString().includes('Task\tStatus'));}
   if(id==='rtf'){assert.ok(bytes.toString().startsWith('{\\rtf1'));assert.ok(bytes.toString().includes('\\u'));}
   if(id==='pdf')await verifyPDF(bytes);
   await expect(studio.getByRole('button',{name:'Convert & download',exact:true})).toBeEnabled();
   checks.push({width,check:id+' actual download and format/content validation',passed:true});
  }
  await showPreview();if(width!==320)await page.screenshot({path:`${out}/${width}-preview.png`});
  await studio.locator('input[type=file]').setInputFiles({name:'imported.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docxBytes});
  await studio.getByRole('status').filter({hasText:'Word imported.'}).waitFor();await expect(editor).toHaveValue(/Conversion Check/);await expect(editor).toHaveValue(/नमस्ते/);const importedTable=parseMarkdown(await editor.inputValue()).tokens.find(token=>token.type==='table');assert.ok(importedTable,'Imported Word table must be valid GFM');assert.equal(inlineText(importedTable.header[0].tokens),'Task');assert.equal(importedTable.rows.length,1);
  const html='<h1>HTML import</h1><p>Safe <strong>text</strong></p><script>window.__mdUnsafe=1</script><img src="https://tracker.invalid/pixel"><a href="javascript:alert(1)">bad</a>';
  await studio.locator('input[type=file]').setInputFiles({name:'import.html',mimeType:'text/html',buffer:Buffer.from(html)});await expect(editor).toHaveValue(/# HTML import/);await expect(editor).toHaveValue(/\*\*text\*\*/);
  assert.ok(!(await editor.inputValue()).includes('__mdUnsafe'));assert.equal(await page.evaluate(()=>window.__mdUnsafe),undefined);assert.equal(trackingRequests,0);
  await studio.getByRole('button',{name:'Undo replacement',exact:true}).click();await expect(editor).toHaveValue(/Conversion Check/);
  checks.push({width,check:'DOCX/HTML to Markdown, HTML sanitization and undo replacement',passed:true});
  const before=await editor.inputValue();await studio.locator('input[type=file]').setInputFiles({name:'legacy.doc',mimeType:'application/msword',buffer:Buffer.from('not a legacy Word parser')});await expect(studio.getByRole('alert')).toContainText('Legacy .doc');assert.equal(await editor.inputValue(),before);
  await edit('# Safe preview\n\n<script>window.__mdUnsafe=1</script>\n\n![tracking](https://tracker.invalid/pixel)\n\n[bad](javascript:alert%281%29)');await showPreview();await expect(preview.getByRole('heading',{name:'Safe preview'})).toBeVisible();assert.equal(await preview.locator('script,img').count(),0);assert.equal(await preview.locator('a[href^="javascript:"]').count(),0);assert.equal(trackingRequests,0);assert.equal(await page.evaluate(()=>window.__mdUnsafe),undefined);
  checks.push({width,check:'invalid import preserves work; scripts, images and active URL protocols remain inert',passed:true});
  await edit(source);const popupEvent=context.waitForEvent('page');await studio.getByRole('button',{name:'Print / Save PDF',exact:true}).click();const popup=await popupEvent;await expect(popup.getByRole('heading',{name:'Conversion Check'})).toBeVisible();assert.equal(await popup.evaluate(()=>window.opener===null),true);await popup.close();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alltoolnexa-markdown-studio-v1')||'{}').source)).toBe(source);await page.reload({waitUntil:'load'});await expect(editor).toHaveValue(source);
  checks.push({width,check:'safe print window and local draft restoration',passed:true});
  if(width===390){
   const long=source+'\n\n'+Array.from({length:12},(_,i)=>`## Section ${i+1}\n\n`+'A longer paragraph tests formatted page breaks and readable document export. '.repeat(12)).join('\n\n');await edit(long);await format.selectOption('pdf');const pending=page.waitForEvent('download',{timeout:60000});await studio.getByRole('button',{name:'Convert & download',exact:true}).click();await verifyPDF(await readFile(await(await pending).path()),true);checks.push({width,check:'nonblank multi-page PDF with real raster content',passed:true});
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify(checks,null,2));console.log(`PASS: ${checks.length} Markdown checks at ${widths.join(', ')}px. Downloads, imports and PDF contents were validated without mocking converters.`);
}finally{await browser.close();}
