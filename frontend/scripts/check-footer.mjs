import {chromium,expect} from '@playwright/test';
import {tools,categories} from '../shared/catalog.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto('http://127.0.0.1:3000/pricing',{waitUntil:'load',timeout:180000});
 const footer=page.getByRole('contentinfo');
 await expect(footer.getByRole('navigation',{name:'Footer tool categories'}).locator('li')).toHaveCount(categories.length);
 const links=await footer.locator('a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
 const known=new Set(tools.map(t=>'/tools/'+t.id));
 for(const link of links.filter(link=>link.startsWith('/tools/')))if(!known.has(link))throw Error('Unknown footer tool '+link);
 await footer.screenshot({path:'logs/footer-desktop.png',timeout:60000});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile footer overflow');
 await footer.screenshot({path:'logs/footer-mobile.png',timeout:60000});
 console.log(JSON.stringify({categoryLinks:categories.length,toolLinks:links.filter(link=>known.has(link)).length,footerLinks:links.length,mobileOverflow:false}));
}finally{await browser.close();}
