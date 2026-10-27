// Run with the local admin dev server listening on 127.0.0.1:3001. API responses are fixtures.
const {chromium}=require('../../frontend/node_modules/@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let signedIn=false,blocked=true;
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let data,status=200;
  const session={success:true,user:{username:'preview-admin',email:'preview@example.test',role:'admin'},csrfToken:'test-csrf'};
  if(path==='/api/auth/config')data={mode:'database'};
  else if(path==='/api/admin/login'){signedIn=true;data=session;}
  else if(path==='/api/admin/session'){status=signedIn&&!blocked?200:401;data=status===200?session:{message:'Please sign in to the admin account.'};}
  else if(!signedIn||blocked){status=401;data={message:'Please sign in to the admin account.'};}
  else if(path==='/api/admin/catalog')data={stats:{canonicalTools:505,categories:{math:44},coveredInventoryIdeas:557,planned:706,needsServiceOrVerifiedData:23},tools:[{id:'percentage-calculator',name:'Percentage Calculator',category:'math'}],inventory:[]};
  else if(path==='/api/admin/health')data={backend:'working',authMode:'database',database:'connected'};
  else data={success:true};
  await route.fulfill({status,json:data,headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:3001','Access-Control-Allow-Credentials':'true'}});
 });
 const page=await context.newPage(); page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 await page.goto('http://127.0.0.1:3001');
 await page.getByRole('button',{name:/^Sign in/}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('fixture-password');
 await page.getByRole('button',{name:/^Sign in/}).click();
 await page.getByRole('alert').waitFor();
 assert.equal(await page.locator('.app-shell').count(),0,'cookie failure must stay on sign-in screen');
 blocked=false;
 await page.getByLabel('Password',{exact:true}).fill('fixture-password');
 await page.getByRole('button',{name:/^Sign in/}).click();
 await page.getByRole('heading',{name:'The whole toolkit.'}).waitFor();
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(dims.scroll<=dims.width,`horizontal overflow at ${width}: ${dims.scroll}`);
  if(width<=800){
   await page.addStyleTag({content:'nextjs-portal{display:none!important}'}); const menu=page.getByRole('button',{name:'Menu',exact:false});
   await menu.click();
   const nav=page.getByRole('navigation',{name:'Admin navigation'});
   await nav.waitFor({state:'visible'});
   for(const button of await nav.getByRole('button').all())assert.equal(await button.isVisible(),true);
   await nav.getByRole('button',{name:'Tool catalog'}).click();
   assert.equal(await nav.isVisible(),false);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Menu',exact:false}).click();
 await page.screenshot({path:require('node:path').resolve(__dirname,'../../frontend/runtime-results/admin-responsive-390.png')});
 blocked=true;
 await page.getByRole('button',{name:'Close menu',exact:false}).click();
 await page.getByRole('button',{name:'Refresh'}).click();
 await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 assert.equal(await page.locator('.app-shell').count(),0,'expired session must return to sign-in');
 console.log('PASS: blocked cookies, expired session, and responsive navigation at 320/390/768/1280px');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
