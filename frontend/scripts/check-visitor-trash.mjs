import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
process.loadEnvFile('../backend/.env');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const api='http://127.0.0.1:5000';let id;
try{
 const login=await context.request.post(api+'/api/admin/login',{data:{username:'admin',password:process.env.DEMO_ADMIN_PASSWORD},headers:{Origin:'http://127.0.0.1:3001'}});expect(login.ok()).toBeTruthy();const csrf=(await login.json()).csrfToken;
 const post=async(path,data)=>{const r=await context.request.post(api+path,{data,headers:{Origin:'http://127.0.0.1:3001','X-CSRF-Token':csrf}});expect(r.ok()).toBeTruthy();return r.json();};
 const guest=await browser.newContext();const start=await guest.request.post(api+'/api/analytics/start',{data:{path:'/__trash_restore_test__'},headers:{Origin:'http://127.0.0.1:3000'}});id=(await start.json()).visitId;await writeFile('logs/trash-test-fixture.json',JSON.stringify({id}));
 const report=await(await context.request.get(api+'/api/admin/analytics?days=1')).json();const own=report.visits.find(v=>v.id===id);expect(own).toBeTruthy();
 const preview=await post('/api/admin/analytics/delete-preview',{range:'6h',visitor:own.visitorId});expect(preview.count).toBe(1);await post('/api/admin/analytics/delete',{confirmationToken:preview.confirmationToken});
 const trash=await(await context.request.get(api+'/api/admin/analytics/trash')).json();expect(trash.visits.some(v=>v.id===id)).toBe(true);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3001/',{timeout:180000});await page.getByRole('button',{name:'Visitor activity',exact:true}).click();await page.getByRole('button',{name:'Open Trash',exact:true}).click();await expect(page.getByRole('region',{name:'Visitor Trash',exact:true})).toContainText('/__trash_restore_test__');
 const row=page.getByRole('row').filter({hasText:'/__trash_restore_test__'});await row.getByRole('button',{name:'Restore',exact:true}).click();await expect(row).toHaveCount(0);
 const restored=await(await context.request.get(api+'/api/admin/analytics?days=1&visitor='+own.visitorId)).json();expect(restored.visits.some(v=>v.id===id)).toBe(true);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Hide Trash'})).toBeVisible();await page.screenshot({path:'logs/visitor-trash-mobile.png',fullPage:true});expect(errors).toEqual([]);console.log(JSON.stringify({softDelete:true,trashVisible:true,restore:true,mobile:true,errors}));await guest.close();
}finally{await context.close();await browser.close();}
