import {chromium} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {Document,Packer,Paragraph} from 'docx';
import fs from 'node:fs/promises';
import {tools,defaults} from '../shared/catalog.mjs';
const output=new URL('../runtime-results/',import.meta.url);await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const setup=await browser.newPage();await setup.goto('http://localhost:3000');
const png=await setup.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(0,0,320,480);x.fillStyle='#00f';x.fillRect(320,0,320,480);return c.toDataURL('image/png').split(',')[1];});await setup.close();
const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(let i=1;i<=5;i++)doc.addPage([300+i*20,450]).drawText('PAGE '+i,{x:30,y:300,font,size:24});
const pdf=Buffer.from(await doc.save()),word=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('Runtime test document')]}]}));
const fixtures={image:{name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')},pdf:{name:'fixture.pdf',mimeType:'application/pdf',buffer:pdf},word:{name:'fixture.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:word}};
const {protectDocument}=await import('../src/lib/reference-files.mjs');fixtures.encrypted={name:'locked.pdf',mimeType:'application/pdf',buffer:Buffer.from(await protectDocument(pdf,'test-password'))};
let queue=tools.filter(t=>!process.env.ONLY_KIND|| (process.env.ONLY_KIND==='browser'?t.kind!=='standard':t.kind==='standard')),index=0,results=[];
if(process.env.ONLY_IDS)queue=tools.filter(t=>process.env.ONLY_IDS.split(',').includes(t.id));
async function worker(){const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(30000);let errors=[];page.on('pageerror',e=>errors.push(e.message));
while(index<queue.length){const tool=queue[index++];errors=[];const started=Date.now();try{
 await page.goto('http://localhost:3000/tools/'+tool.id,{timeout:90000,waitUntil:'domcontentloaded'});await page.locator('.workbench').waitFor();
 if(tool.kind==='timer'){await page.getByRole('button',{name:/^Start/}).click();await page.getByRole('button',{name:/^Pause/}).waitFor();await page.getByRole('button',{name:/^Pause/}).click();}
 else {
 if(tool.accept&&!tool.noFile){let file=tool.mode==='word-pdf'?fixtures.word:tool.mode==='unlock'?fixtures.encrypted:(tool.kind==='image'||tool.kind==='image-exif'||tool.mode==='images')?fixtures.image:fixtures.pdf;
 await page.locator('input[type=file]').setInputFiles(tool.multiple?[file,{...file,name:'second-'+file.name}]:file);await page.locator('.ordered-files').first().waitFor();}
 if(['protect','unlock'].includes(tool.mode))await page.locator('#field-password').fill('test-password');
 if(tool.kind==='base64-image')await page.locator('#field-text').fill('data:image/png;base64,'+png);
 await page.locator('.tool-form .button.primary').click();
 await page.waitForFunction(()=>document.querySelector('.result-content pre')||document.querySelector('#tool-error'),{},{timeout:60000});
 const err=await page.locator('#tool-error').textContent().catch(()=>null);if(err)throw Error(err);
 const link=page.locator('.result-actions a[download]');if(await link.count()){const bytes=await link.evaluate(async a=>(await (await fetch(a.href)).arrayBuffer()).byteLength);if(!bytes)throw Error('Empty download');}
 }
 if(errors.length)throw Error(errors.join('; '));results.push({id:tool.id,kind:tool.kind,status:'pass',ms:Date.now()-started});
 }catch(e){results.push({id:tool.id,kind:tool.kind,status:'fail',error:e.message,ms:Date.now()-started});console.log('FAIL',tool.id,e.message.slice(0,250));await page.screenshot({path:new URL(tool.id+'.png',output).pathname.slice(1),fullPage:true}).catch(()=>{});}
 await fs.writeFile(new URL('results.json',output),JSON.stringify(results,null,2));if(results.length%20===0)console.log('Checked',results.length,'/',queue.length);
}await page.close();}
await Promise.all([worker(),worker()]);await browser.close();console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.status==='pass').length,failures:results.filter(r=>r.status==='fail')},null,2));
