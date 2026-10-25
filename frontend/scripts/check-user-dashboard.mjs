import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
const file={id:'11111111-1111-4111-8111-111111111111',name:'storage-check.txt',sizeBytes:17,createdAt:new Date().toISOString()};let files=[],uploaded=false;
try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://prahlad800.pythonanywhere.com/api/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname;const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:3000','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type,X-CSRF-Token','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let value={success:true};
  if(path==='/api/auth/session')value={success:true,user:{id:'22222222-2222-4222-8222-222222222222',email:'dashboard-check@example.invalid'},csrfToken:'ui-only-test'};
  else if(path==='/api/public/availability')value={success:true,disabledTools:[],disabledCategories:[]};
  else if(path==='/api/user/storage')value={success:true,plan:'Free',quotaBytes:50000000,maxFileBytes:2000000,usedBytes:files.reduce((a,f)=>a+f.sizeBytes,0),fileCount:files.length,files,pagination:{page:1,hasMore:false}};
  else if(path==='/api/user/storage/upload'){expect(r.headers()['content-type']).toContain('multipart/form-data; boundary=');expect(r.headers()['x-csrf-token']).toBe('ui-only-test');files=[file];uploaded=true;}
  else if(path.endsWith('/delete'))files=[];
  else if(path.includes('/api/user/storage/files/'))return route.fulfill({status:200,headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="storage-check.txt"'},body:'storage test data'});
  return route.fulfill({status:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(value)});
 });
 await page.goto('http://127.0.0.1:3000/dashboard',{waitUntil:'load',timeout:180000});await expect(page.getByRole('heading',{name:'Your dashboard.'})).toBeVisible({timeout:60000});await expect(page.getByText('No files yet',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();
 await page.getByLabel('Choose file for cloud storage').setInputFiles({name:file.name,mimeType:'text/plain',buffer:Buffer.from('storage test data')});await expect(page.getByRole('button',{name:'Download '+file.name,exact:true})).toBeVisible();expect(uploaded).toBe(true);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download '+file.name,exact:true}).click()]);expect(await readFile(await download.path(),'utf8')).toBe('storage test data');
 await page.getByLabel('Choose file for cloud storage').setInputFiles({name:'oversized.txt',mimeType:'text/plain',buffer:Buffer.alloc(2000001)});await expect(page.getByRole('alert').filter({hasText:'Each file'})).toContainText('2 MB');
 await page.getByRole('button',{name:'Delete '+file.name,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete file',exact:true}).click();await expect(page.getByText('No files yet',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'logs/user-dashboard-mobile.png',fullPage:true});await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));await page.screenshot({path:'logs/user-dashboard-dark.png',fullPage:true});expect(errors).toEqual([]);
 const result={mockedApi:true,dashboard:true,uploadMultipart:true,download:true,oversizeRejected:true,delete:true,mobile:true,errors};await writeFile('logs/user-dashboard-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await context.close();await browser.close();}
