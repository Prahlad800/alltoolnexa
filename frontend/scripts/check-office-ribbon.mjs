import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 for(const app of ['draftsheet','draftword']){
  await page.goto('http://127.0.0.1:3000/'+app,{waitUntil:'load',timeout:180000});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light',{timeout:60000});
  const ribbon=page.getByRole('tabpanel',{name:'Home controls',exact:true});
  const dimensions=await ribbon.evaluate(el=>{const box=el.getBoundingClientRect();return {width:el.clientWidth,content:el.scrollWidth,height:box.height,clippedCaptions:[...el.querySelectorAll('small')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&r.bottom>box.bottom+1;}).map(n=>n.textContent)};});
  if(dimensions.clippedCaptions.length)throw Error('Clipped captions: '+JSON.stringify(dimensions));
  await page.screenshot({path:`logs/${app}-icons-final.png`,timeout:60000});
  console.log(app,JSON.stringify(dimensions));
 }
}finally{await browser.close();}
