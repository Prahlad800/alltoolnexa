import {chromium} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3101';
const output=new URL('../runtime-results/upgrade/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>localStorage.setItem('alltoolnexa-language','en'));page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tools/crop-pdf',{timeout:180000,waitUntil:'domcontentloaded'});
 // Finish the real language interaction before testing file inputs on a cold client bundle.
 await page.getByRole('button',{name:'Choose language',exact:true}).click();
 await page.locator('dialog[open] button[lang=en]').click();
 const doc=await PDFDocument.create();doc.addPage([200,400]).drawText('Original document');doc.addPage([300,500]);
 await page.locator('#tool-files').setInputFiles({name:'sample.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 await page.getByRole('button',{name:'Apply to this page',exact:true}).waitFor({timeout:90000});
 await page.locator('#field-left').fill('10');
 await page.locator('.form-actions button.primary').click();
 const link=page.locator('.result-actions a[download]');await link.waitFor({timeout:90000});
 let pending=page.waitForEvent('download');await link.click();let download=await pending;const cropPath=fileURLToPath(new URL('cropped.pdf',output));await download.saveAs(cropPath);
 const cropped=await PDFDocument.load(await readFile(cropPath));assert.equal(cropped.getPageCount(),2);assert.equal(cropped.getPage(0).getCropBox().width,170);
 await page.screenshot({path:fileURLToPath(new URL('crop-desktop.png',output)),fullPage:true});
 page.on('dialog',d=>d.accept());await page.goto(origin+'/tools/batch-image-resize',{timeout:180000,waitUntil:'domcontentloaded'});
 const png=Buffer.from(await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=20;c.height=10;c.getContext('2d').fillRect(0,0,20,10);return [...new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer())];}));
 const file=i=>({name:`image-${i}.png`,mimeType:'image/png',buffer:png});
 await page.locator('#tool-files').setInputFiles(Array.from({length:50},(_,i)=>file(i)));
 await page.locator('.ordered-files li').last().waitFor({timeout:90000});assert.equal(await page.locator('.ordered-files li').count(),50);
 await page.locator('#tool-files').setInputFiles(Array.from({length:50},(_,i)=>file(i+50)));
 await page.waitForFunction(()=>document.querySelectorAll('.ordered-files li').length===100);
 assert.match(await page.locator('.ordered-files li').first().innerText(),/image-0.png/);assert.match(await page.locator('.ordered-files li').last().innerText(),/image-99.png/);
 await page.locator('#field-a').fill('40');await page.locator('#field-b').fill('0');await page.locator('#field-format').selectOption('image/png');
 await page.locator('.form-actions button.primary').click();await link.waitFor({timeout:180000});
 pending=page.waitForEvent('download');await link.click();download=await pending;const zipPath=fileURLToPath(new URL('resized.zip',output));await download.saveAs(zipPath);
 const zip=await JSZip.loadAsync(await readFile(zipPath));assert.equal(Object.keys(zip.files).length,100);
 for(const entry of Object.values(zip.files)){const bytes=await entry.async('uint8array');const dimensions=await page.evaluate(async bytes=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const result=[bitmap.width,bitmap.height];bitmap.close();return result;},[...bytes]);assert.deepEqual(dimensions,[40,20]);}
 await page.setViewportSize({width:375,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth>=1280));await page.screenshot({path:fileURLToPath(new URL('batch-narrow-desktop.png',output)),fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(new URL('results.json',output),JSON.stringify({crop:'downloaded and reopened PDF; correct boundaries',batch:'50 + 50 appended in order; 100 PNGs downloaded, decoded and measured at 40 × 20',desktopLayoutOnNarrowWindow:true,errors},null,2));console.log('PASS: crop PDF and 100-image ZIP downloads, output dimensions, upload append order, desktop layout on narrow window');
}finally{await browser.close();}
