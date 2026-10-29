import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import plans from '../shared/plans.json' with {type:'json'};
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3104',out='runtime-results/annual-pricing';
const widths=process.env.AUDIT_WIDTHS?process.env.AUDIT_WIDTHS.split(',').map(Number):[320,390,1440];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}),checks=[];
try{
 for(const width of widths){
  console.log(`Checking annual pricing at ${width}px`);
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<768,hasTouch:width<768});
  await context.addInitScript(()=>{
   if(window!==window.top)return;localStorage.setItem('alltoolnexa-language','en');window.__checkouts=[];
   window.Razorpay=class{constructor(options){window.__checkoutOptions=options;}on(){}open(){const options=window.__checkoutOptions;window.__checkouts.push({amount:options.amount,description:options.description});}};
  });
  const page=await context.newPage(),errors=[],orders=[];let legacy=false,mismatch=false;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;let json={success:true},status=200;
   if(path==='/api/auth/session')json={user:{id:'test-user',email:'test@example.com'},csrfToken:'test-csrf'};
   else if(path==='/api/me')json={plan:'free',is_premium:false,allowed_languages:['en','hi']};
   else if(path==='/api/public/availability')json={disabledTools:[],disabledCategories:[]};
   else if(path==='/api/billing/plans')json={plans,checkoutEnabled:true,billingCycles:legacy?['monthly']:['monthly','yearly']};
   else if(path==='/api/billing/orders'){
    const body=request.postDataJSON();orders.push(body);assert.equal(request.headers()['x-csrf-token'],'test-csrf');
    const plan=plans.find(item=>item.id===body.planId),cycle=mismatch?'monthly':body.billingCycle;
    json={orderId:'order_test',amount:(cycle==='yearly'?plan.annualPrice:plan.price)*100,currency:'INR',keyId:'rzp_test_fake',billingCycle:cycle};
   }
   await route.fulfill({status,json,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type, X-CSRF-Token'}});
  });
  await page.goto(origin+'/pricing',{waitUntil:'load'});
  const section=page.locator('#pricing'),monthly=section.getByRole('button',{name:'Monthly',exact:true}),yearly=section.getByRole('button',{name:/^Annual/});
  const paid=plans.filter(plan=>plan.price);
  for(const plan of paid)await expect(section.getByRole('article',{name:plan.name+' plan',exact:true}).locator('p').first()).toContainText('₹'+plan.price);
  await yearly.click();await expect(yearly).toHaveAttribute('aria-pressed','true');
  for(const [id,equivalent,discount,saving] of [['basic','₹29.08','25.4%',119],['pro','₹79.08','11.1%',119],['premium','₹133.25','10.6%',189],['premium-plus','₹166.67','16.2%',388]]){
   const plan=plans.find(item=>item.id===id),card=section.getByRole('article',{name:plan.name+' plan',exact:true});
   await expect(card.locator('p').first()).toContainText('₹'+plan.annualPrice.toLocaleString('en-IN'));await expect(card.locator('p').first()).toContainText('/year');await expect(card.getByText(equivalent,{exact:true})).toBeVisible();await expect(card.getByText('Save '+discount,{exact:true})).toBeVisible();await expect(card.getByText(new RegExp('Save ₹'+saving+'/year'))).toBeVisible();
   const opens=await page.evaluate(()=>window.__checkouts.length);await card.getByRole('button',{name:/^Choose/}).click();await expect(monthly).toBeDisabled();await expect.poll(()=>page.evaluate(()=>window.__checkouts.length)).toBe(opens+1);
   const checkout=await page.evaluate(()=>window.__checkouts.at(-1));assert.equal(checkout.amount,plan.annualPrice*100);assert.ok(checkout.description.includes('12 months'));assert.deepEqual(orders.at(-1),{planId:plan.id,billingCycle:'yearly'});
   await page.evaluate(()=>window.__checkoutOptions.modal.ondismiss());await expect(monthly).toBeEnabled();
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const free=section.getByRole('article',{name:'Free plan',exact:true});await expect(free.locator('p').first()).toContainText('₹0');await expect(free.getByRole('link',{name:'Get Started'})).toHaveAttribute('href','/signup');
  if(width!==320){await yearly.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-annual.png`,fullPage:width===390});}
  checks.push({width,check:'all monthly/annual prices, equivalents, savings, Free plan and annual checkout payloads',passed:true});
  const basic=section.getByRole('article',{name:'Basic plan',exact:true});const before=orders.length,count=await page.evaluate(()=>window.__checkouts.length);legacy=true;
  await basic.getByRole('button',{name:/^Choose/}).click();await expect(basic.getByRole('alert')).toContainText('Annual checkout is not available');assert.equal(orders.length,before);assert.equal(await page.evaluate(()=>window.__checkouts.length),count);
  await monthly.click();const monthlyOpens=await page.evaluate(()=>window.__checkouts.length);await basic.getByRole('button',{name:/^Choose/}).click();await expect.poll(()=>page.evaluate(()=>window.__checkouts.length)).toBe(monthlyOpens+1);assert.equal(orders.at(-1).billingCycle,'monthly');assert.equal((await page.evaluate(()=>window.__checkouts.at(-1))).amount,3900);await page.evaluate(()=>window.__checkoutOptions.modal.ondismiss());
  await yearly.click();legacy=false;mismatch=true;const previous=await page.evaluate(()=>window.__checkouts.length);
  await basic.getByRole('button',{name:/^Choose/}).click();await expect(basic.getByRole('alert')).toContainText('billing cycle did not match');assert.equal(await page.evaluate(()=>window.__checkouts.length),previous);
  checks.push({width,check:'legacy backend blocks annual before order; monthly survives; mismatched orders cannot open payment',passed:true});
  await page.goto(origin+'/',{waitUntil:'load'});await page.locator('#pricing').getByRole('button',{name:/^Annual/}).click();await expect(page.locator('#pricing').getByRole('article',{name:'Basic plan',exact:true}).locator('p').first()).toContainText('₹349');
  checks.push({width,check:'homepage pricing toggle',passed:true});assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify(checks,null,2));console.log(`PASS: ${checks.length} pricing/browser checks. Razorpay and API calls were mocked; no live payment was attempted.`);
}finally{await browser.close();}
