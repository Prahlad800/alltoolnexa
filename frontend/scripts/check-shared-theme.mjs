import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 for(const path of ['/tools','/categories','/categories/image','/popular-tools','/tools/word-counter','/login','/about','/contact','/pricing']){
  const response=await page.goto('http://127.0.0.1:3000'+path,{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('main').waitFor();
  const colors=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,accent:getComputedStyle(document.body).getPropertyValue('--green').trim()}));
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(JSON.stringify({path,status:response.status(),...colors,mobileOverflow:overflow}));
  if(response.status()!==200||overflow)throw Error('Route or mobile layout check failed: '+path);
  await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto('http://127.0.0.1:3000/tools',{waitUntil:'domcontentloaded',timeout:120000});
 await page.screenshot({path:'logs/shared-theme-tools.png',timeout:60000});
 await page.goto('http://127.0.0.1:3000/login',{waitUntil:'domcontentloaded',timeout:120000});
 await page.screenshot({path:'logs/shared-theme-login.png',timeout:60000});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 console.log('Dark palette:',await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--green').trim()));
 console.log('Browser errors:',JSON.stringify(errors));
 if(errors.length)throw Error('Browser errors detected');
}finally{await browser.close();}
