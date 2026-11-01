import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {scienceCalculators} from '../shared/science-calculators.mjs';
import {getTool,defaults,evaluate} from '../shared/catalog.mjs';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3104',directory='runtime-results/science-calculators';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}),checks=[];
try {
 for(const width of [320,390,1440]) {
  console.log('Checking new calculators at '+width+'px');
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<768,hasTouch:width<768});
  await context.addInitScript(()=>localStorage.setItem('alltoolnexa-language','en'));
  await context.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   await route.fulfill({status:200,json:path.includes('availability')?{disabledTools:[],disabledCategories:[]}:path.includes('/me')?{plan:'free',is_premium:false,allowed_languages:['en','hi']}:{user:null},headers:{'Access-Control-Allow-Origin':'*'}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const def of scienceCalculators) {
   const response=await page.goto(origin+'/tools/'+def.id,{waitUntil:'load'});assert.equal(response.status(),200);
   await expect(page.getByRole('heading',{level:1,name:def.name,exact:true})).toBeVisible();
   const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');assert.equal(canonical,'https://alltoolnexa.pages.dev/tools/'+def.id);
   const workbench=page.getByRole('region',{name:def.name+' workbench'}),form=workbench.locator('form'),result=workbench.locator('.result-panel');
   await form.getByRole('button',{name:'Calculate →',exact:true}).click();
   await expect(result.getByRole('heading',{name:'Ready! Review your result'})).toBeVisible();
   await expect(form).toBeVisible();
   await expect(result.getByText(def.output,{exact:true})).toBeVisible();
   const expected=evaluate(def.id,defaults(getTool(def.id)));
   if(typeof expected==='number')await expect(result.locator('pre')).toHaveText(String(expected));
   else for(const val of Object.values(expected))await expect(result.locator('.result-metrics')).toContainText(String(val));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),def.id+' overflow '+width);
   const formBox=await form.boundingBox(),resultBox=await result.boundingBox();
   if(width<768)assert.ok(resultBox.y>=formBox.y+formBox.height-2,def.id+' mobile stack');
   else assert.ok(resultBox.x>=formBox.x+formBox.width-2,def.id+' desktop columns');
   await expect(page.getByText(def.explanation,{exact:true}).first()).toBeAttached();
   if(def.id==='kinetic-energy-calculator')await workbench.screenshot({path:`${directory}/kinetic-${width}.png`});
   await form.getByRole('button',{name:'Reset inputs',exact:true}).click();
   for(const field of def.fields)await expect(form.locator('#field-'+field.key)).toHaveValue(String(field.value));
   await expect(result.locator('.result-warning')).toContainText('inputs have changed');
   await form.getByRole('button',{name:'Clear inputs and result',exact:true}).click();await expect(result.locator('.result-placeholder')).toBeVisible();
   checks.push({id:def.id,width,status:200,calculation:true,layout:true,reset:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(directory+'/results.json',JSON.stringify(checks,null,2));console.log(`PASS: ${checks.length} calculator browser checks. Shared API/session responses were mocked; calculations ran locally.`);
}finally{await browser.close();}
