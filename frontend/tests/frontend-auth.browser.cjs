// Run with the public dev server at 127.0.0.1:3000; all API data is synthetic.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let signedIn=false,blocked=true;
  await context.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   let data={success:true},status=200;
   const session={success:true,user:{email:'preview@example.test',role:'user'},csrfToken:'fixture-csrf'};
   if(pathname==='/api/public/availability')data={success:true,disabledTools:[],disabledCategories:[]};
   else if(pathname==='/api/auth/config')data={success:true,mode:'database'};
   else if(['/api/auth/login','/api/auth/signup'].includes(pathname)){signedIn=true;data=session;}
   else if(pathname==='/api/auth/logout'){signedIn=false;}
   else if(pathname==='/api/auth/session'){status=signedIn&&!blocked?200:401;data=status===200?session:{message:'Please sign in to the user account.'};}
   else if(pathname.startsWith('/api/user/')){
    status=signedIn&&!blocked?200:401;
    data=status===200?{plan:'Free',quotaBytes:50000000,maxFileBytes:2000000,usedBytes:0,fileCount:0,files:[],pagination:{page:1,hasMore:false}}:{message:'Please sign in to the user account.'};
   }
   await route.fulfill({status,json:data,headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:3000','Access-Control-Allow-Credentials':'true'}});
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:3000/dashboard');
  const signedOut=page.getByRole('heading',{name:'Your workspace awaits.'});
  await signedOut.waitFor();
  const card=await signedOut.locator('..').boundingBox();
  assert.ok(card.height<400,'logged-out card must not stretch to fill the page');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'guest header overflow at '+width);const search=await page.locator('.header-search').boundingBox();const account=await page.locator('.user-navigation').boundingBox();assert.ok(search.x+search.width<=account.x+1,'guest actions overlap at '+width);}
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:3000/login');
  await page.getByLabel('Email address').fill('preview@example.test');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#auth-error').waitFor();
  assert.match(await page.locator('#auth-error').innerText(),/could not keep your session/);
  assert.match(page.url(),/\/login$/);
  blocked=false;
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Your dashboard.',exact:true}).waitFor();
  await page.getByRole('heading',{name:'My cloud files'}).waitFor();
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  for(const width of [320,390,768,1024,1280]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
   if(width<=800){
    const brand=await page.locator('.site-header .brand').boundingBox();
    const theme=await page.locator('.site-header .theme-toggle').boundingBox();
    assert.ok(brand.x+brand.width<=theme.x+1,`logo overlaps theme at ${width}`);
    const search=await page.locator('.header-search').boundingBox();
    const account=await page.locator('.user-navigation').boundingBox();
    assert.ok(search.x+search.width<=account.x+1,`search overlaps account at ${width}`);
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.resolve(__dirname,'../runtime-results/frontend-dashboard-responsive.png')});
  blocked=true;
  await page.getByRole('button',{name:'Refresh files'}).click();
  await signedOut.waitFor();
  assert.equal(await page.getByRole('heading',{name:'My cloud files'}).count(),0);
  console.log('PASS: blocked-cookie login, dashboard load, expired session, compact card and header at 320–1280px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
