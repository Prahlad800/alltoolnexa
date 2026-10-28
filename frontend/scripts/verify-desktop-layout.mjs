import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3101';
const output='runtime-results/desktop-layout';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
try{
 const results=[];
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>localStorage.setItem('alltoolnexa-language','en'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/','/tools','/tools/crop-pdf']){
   await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:180000});
   await page.locator('.site-header nav').waitFor({timeout:60000});
   assert.equal(await page.locator('.mobile-navigation').count(),0);
   const measurements=await page.evaluate(()=>({innerWidth,bodyWidth:document.body.getBoundingClientRect().width,viewport:document.querySelector('meta[name=viewport]').content,scale:visualViewport.scale,sidebar:document.querySelector('.toolbox-sidebar')?.getBoundingClientRect().x,main:document.querySelector('.tool-page-main')?.getBoundingClientRect().x,columns:document.querySelector('.directory-grid')?getComputedStyle(document.querySelector('.directory-grid')).gridTemplateColumns:null}));
   assert.ok(measurements.bodyWidth>=1280);
   assert.match(measurements.viewport,/width=1280/);assert.doesNotMatch(measurements.viewport,/user-scalable=no|maximum-scale=1/);
   if(mobile)assert.ok(measurements.scale<1,'Phone should fit the desktop viewport initially');
   if(route==='/tools')assert.ok(measurements.columns.split(' ').length>=3);
   if(route==='/tools/crop-pdf')assert.ok(measurements.sidebar<measurements.main,'Toolbox must stay beside the desktop workspace');
   results.push({mobile,route,...measurements});
   await page.screenshot({path:`${output}/${mobile?'phone':'desktop'}-${route==='/'?'home':route.replaceAll('/','-').slice(1)}.png`});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify(results,null,2));console.log('PASS: desktop navigation, cards, sidebars and viewport on desktop and phone; pinch zoom enabled.');
}finally{await browser.close();}
