import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
process.loadEnvFile('../backend/.env');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}});
let csrf=null,ownVisitor=null;
const api='http://127.0.0.1:5000';
const adminPost=async(path,data)=>{const response=await context.request.post(api+path,{data,headers:{Origin:'http://127.0.0.1:3001','X-CSRF-Token':csrf||''}});expect(response.ok()).toBe(true);return response.json();};
try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'load',timeout:180000});await expect(page.getByRole('button',{name:'Sign in'})).toBeEnabled({timeout:60000});await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_ADMIN_PASSWORD);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('navigation',{name:'Admin navigation'})).toBeVisible({timeout:60000});csrf=(await(await context.request.get(api+'/api/admin/session')).json()).csrfToken;
 await page.getByRole('button',{name:'Visitor activity',exact:true}).click();
 const panel=page.getByRole('region',{name:'Delete visitor history',exact:true});
 for(const label of ['6 hours','1 day','1 month','6 months','1 year']){await panel.getByRole('button',{name:label,exact:true}).click();await expect(panel.getByRole('button',{name:'Delete last '+label,exact:true})).toBeVisible();}
 await panel.getByRole('button',{name:'Delete last 1 year',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Confirm history deletion',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('All visitors');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();
 // Create one isolated synthetic guest visit; never test deletion on real visitors.
 const guest=await browser.newContext();const start=await guest.request.post(api+'/api/analytics/start',{data:{path:'/__history_delete_test__'},headers:{Origin:'http://127.0.0.1:3000'}});expect(start.status()).toBe(201);const id=(await start.json()).visitId;
 const report=await(await context.request.get(api+'/api/admin/analytics?days=1')).json();const own=report.visits.find(v=>v.id===id);expect(own).toBeTruthy();ownVisitor=own.visitorId;
 await page.getByRole('button',{name:'Refresh activity',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh activity',exact:true})).toBeEnabled({timeout:60000});
 const row=page.getByRole('region',{name:'Visitor activity table'}).getByRole('row').filter({hasText:ownVisitor.slice(0,10)});await row.getByRole('button').click();await expect(panel).toContainText('visitor '+ownVisitor.slice(0,10)+' only');
 await panel.getByRole('button',{name:'6 hours',exact:true}).click();await panel.getByRole('button',{name:'Delete last 6 hours',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog).toContainText('1 visit record');await dialog.getByRole('button',{name:'Delete 1 visit',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(panel.getByRole('status')).toContainText('1 visit record deleted.');
 const remaining=await(await context.request.get(api+'/api/admin/analytics?visitor='+ownVisitor)).json();expect(remaining.summary.pageViews).toBe(0);
 await page.setViewportSize({width:390,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await panel.screenshot({path:'logs/history-delete-mobile.png'});await page.getByRole('button',{name:'Use dark theme',exact:true}).click();await panel.screenshot({path:'logs/history-delete-dark.png'});
 expect(errors).toEqual([]);const result={allFivePresets:true,preview:true,cancelPreservesData:true,ownFixtureDeleted:true,scopedDeletion:true,mobile:true,darkTheme:true,errors};await writeFile('logs/history-delete-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await guest.close();
}finally{
 if(ownVisitor&&csrf){const preview=await adminPost('/api/admin/analytics/delete-preview',{range:'6h',visitor:ownVisitor});if(preview.count)await adminPost('/api/admin/analytics/delete',{confirmationToken:preview.confirmationToken});}
 if(csrf)await adminPost('/api/admin/logout',{}).catch(()=>{});
 await context.close();await browser.close();
}
