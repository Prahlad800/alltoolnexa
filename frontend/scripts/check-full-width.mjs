import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();
 for(const width of [1920,1440,390]){
  await page.setViewportSize({width,height:1080});
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded',timeout:120000});
  const result=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,header:document.querySelector('.header-inner').getBoundingClientRect().width,hero:document.querySelector('h1').parentElement.parentElement.getBoundingClientRect().width}));
  if(result.page>width)throw Error('Horizontal overflow at '+width);
  if(width>1000&&result.hero<width*.85)throw Error('Hero is still constrained');
  console.log(JSON.stringify(result));
 }
}finally{await browser.close();}
