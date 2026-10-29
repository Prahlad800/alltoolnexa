import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3000';
const output='runtime-results/responsive-layout';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const results=[];
 for(const width of [320,390,768,1440]){
  const mobile=width<768;
  const context=await browser.newContext({viewport:{width,height:900},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>localStorage.setItem('alltoolnexa-language','en'));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const route of ['/','/tools','/categories','/tools/crop-pdf','/tools/percentage-calculator','/pricing','/login','/translate']){
   console.log(`Checking ${width}px ${route}`);
   await page.goto(origin+route,{waitUntil:'load',timeout:120000});
   await page.locator('.brand').first().waitFor();
   const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,viewport:document.querySelector('meta[name=viewport]').content}));
   assert.match(geometry.viewport,/width=device-width/);
   assert.doesNotMatch(geometry.viewport,/user-scalable=no|maximum-scale=1/);
   assert.ok(geometry.scrollWidth<=width+1,`${width} ${route}: page overflow ${geometry.scrollWidth}`);
   assert.equal(await page.locator('.mobile-navigation').isVisible(),mobile);
   assert.equal(await page.getByRole('navigation',{name:'Main navigation',exact:true}).isVisible(),!mobile);
   if(route==='/tools'){
    await page.getByRole('searchbox',{name:'Search tools',exact:true}).fill('percentage');
    await page.getByRole('heading',{name:'Percentage Calculator',exact:true}).waitFor();
    if(mobile){
     await page.locator('.mobile-category select').selectOption('pdf');
     await page.getByRole('searchbox',{name:'Search tools',exact:true}).fill('not-a-real-tool-zqxv');
     await page.getByRole('heading',{name:'No tools found',exact:true}).waitFor();
     await page.getByRole('searchbox',{name:'Search tools',exact:true}).fill('');
     assert.ok(await page.locator('.directory-grid .tool-card').count()>0);
    }
   }
   if(route==='/tools/percentage-calculator'){
    const sidebar=page.locator('.toolbox-sidebar');
    if(await sidebar.count())assert.equal(await sidebar.isVisible(),!mobile);
   }
   results.push({width,route,...geometry});
   if(width===390||width===1440)await page.screenshot({path:`${output}/${width}-${route==='/'?'home':route.replaceAll('/','-').slice(1)}.png`,fullPage:route==='/translate'});
  }
  // Switching a free language uses local i18next resources.
  await page.goto(origin+'/',{waitUntil:'load'});
  await page.getByRole('button',{name:'Choose language',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:/हिन्दी/}).click();
  await page.waitForFunction(()=>document.documentElement.lang==='hi');
  if(mobile)await page.getByRole('heading',{name:'आज आप क्या बनाएँगे?'}).waitFor();
  await page.getByRole('button',{name:'Choose language',exact:true}).click();
  await dialog.getByRole('button',{name:/English/}).click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  await page.getByRole('button',{name:'Choose language',exact:true}).click();
  const lockedFrench=dialog.getByRole('button',{name:/Français.*locked/});
  await lockedFrench.waitFor();
  await lockedFrench.click();
  await page.waitForURL('**/pricing');
  // Explicit submission only: fixture isolates UI behavior from model provisioning.
  let submissions=0;
  await page.route('**/api/i18n/translate',async route=>{
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, X-CSRF-Token','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'POST, OPTIONS'}});return;}
   submissions++;
   assert.deepEqual(route.request().postDataJSON(),{text:'Hello world',source:'en',target:'hi'});
   await route.fulfill({json:{success:true,engine:'argos',source:'en',target:'hi',translation:'नमस्ते दुनिया'},headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'}});
  });
  await page.goto(origin+'/translate',{waitUntil:'load'});
  await page.getByRole('textbox',{name:'Text to translate'}).fill('Hello world');
  assert.equal(submissions,0);
  await page.getByRole('button',{name:'Translate',exact:true}).click();
  await page.getByText('नमस्ते दुनिया',{exact:true}).waitFor();
  assert.equal(submissions,1);
  await page.getByRole('textbox',{name:'Text to translate'}).fill('Changed input');
  assert.equal(await page.getByText('नमस्ते दुनिया',{exact:true}).count(),0);
  assert.deepEqual(errors,[],`browser errors at ${width}px`);
  await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify(results,null,2));
 console.log(`PASS: ${results.length} responsive route checks; search, category filtering, English/Hindi switching, Premium locks and explicit translator submission. Translation inference was mocked only in the UI submission check.`);
}finally{await browser.close();}
