import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded',timeout:120000});
 const art=page.getByRole('img',{name:'AllToolNexa digital workspace illustration'});
 const label=await art.locator('img').evaluate(img=>{const s=getComputedStyle(img.parentElement,'::after');return {text:s.content,color:s.color};});
 if(!label.text.includes('AllToolNexa')||label.color!=='rgb(255, 255, 255)')throw Error('Wordmark contrast check failed');
 await art.screenshot({path:'logs/hero-wordmark-fixed.png',timeout:60000});
 console.log(JSON.stringify(label));
}finally{await browser.close();}
