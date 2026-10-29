import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('../backend/.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2')];}));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext();
const page=await context.newPage();
page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(120000);
await context.addInitScript(()=>localStorage.setItem('alltoolnexa-language','en'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const origin='http://127.0.0.1:3001',api='http://127.0.0.1:5000';
let csrf,original;
async function toggle(id,enabled){const r=await context.request.post(api+'/api/admin/controls',{headers:{Origin:origin,'X-CSRF-Token':csrf},data:{kind:'category',id,enabled}});assert.equal(r.status(),200);}
try{
 const login=await context.request.post(api+'/api/admin/login',{headers:{Origin:origin},data:{username:env.DEMO_ADMIN_USERNAME,password:env.DEMO_ADMIN_PASSWORD}});assert.equal(login.status(),200);csrf=(await login.json()).csrfToken;
 const controls=await (await context.request.get(api+'/api/admin/controls')).json();original=controls.disabledCategories;assert.equal(controls.mainCategories.length,5);assert.equal(controls.categories.length,18);
 console.log('Admin session verified');await page.goto(origin,{waitUntil:'domcontentloaded'});console.log('Admin loaded');await page.getByRole('button',{name:'Tools & categories',exact:false}).click();await page.getByRole('button',{name:'Main categories (5)',exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),5);
 await page.getByRole('button',{name:'Subcategories (18)',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),18);
 await page.getByRole('button',{name:'Recent users',exact:false}).click();await page.getByRole('columnheader',{name:'Last login',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:3000/categories',{waitUntil:'domcontentloaded'});console.log('Category browser loaded');await page.locator('.taxonomy-group').first().waitFor();assert.equal(await page.locator('.taxonomy-group').count(),5);assert.equal(await page.locator('.taxonomy-children a').count(),18);
 if(await page.locator('dialog[open]').count())await page.locator('dialog[open] button[lang="en"]').click();
 await page.goto('http://127.0.0.1:3000/tools?category=pdf-image',{waitUntil:'domcontentloaded'});await page.getByRole('status').filter({hasText:'68 results'}).waitFor();
 console.log('Grouped filter verified');await toggle('pdf-image',false);await page.goto('http://127.0.0.1:3000/categories/pdf',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Temporarily unavailable'}).waitFor();
 await page.goto('http://127.0.0.1:3000/tools/pdf-merge',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Temporarily unavailable'}).waitFor();
 await toggle('pdf',false);await toggle('pdf-image',true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Temporarily unavailable'}).waitFor();
 await toggle('pdf',true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'PDF Merge',exact:false}).first().waitFor();
 assert.deepEqual(errors,[]);console.log('Browser: admin hierarchy, recent users, grouped filter, inherited blocking and child preservation passed.');
}finally{
 if(original){for(const id of ['pdf-image','pdf'])await toggle(id,!original.includes(id));}
 await browser.close();
}
