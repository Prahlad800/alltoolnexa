import {chromium,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
process.loadEnvFile('../backend/.env');
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],failures=[],errors=[];
await mkdir('logs',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630}});
 const svg=await readFile('public/social-card.svg','utf8');
 await page.setContent(`<style>html,body{margin:0;width:1200px;height:630px;overflow:hidden}</style>${svg}`);
 await page.screenshot({path:'public/social-card.png'});
 page.on('pageerror',e=>errors.push(e.message));
 const routes=['/','/tools','/categories','/categories/pdf','/tools/percentage-calculator','/tools/pdf-merge','/pricing','/about','/login','/office','/draftword','/draftsheet'];
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){
   const response=await page.goto('http://127.0.0.1:3000'+route,{waitUntil:'load',timeout:180000});
   await expect(page.locator('html')).toHaveAttribute('data-theme','light',{timeout:60000});
   const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.right>innerWidth+2&&s.position!=='fixed'&&!el.closest('[role="tabpanel"], [class*="ribbon"], [class*="table"], [class*="grid"], [class*="Grid"], [class*="tabs"], [class*="Tabs"], [class*="documentCanvas"], [class*="sheet"]');}).slice(0,5).map(el=>el.tagName+'.'+el.className)}));
   if(response.status()!==200||metrics.scroll>width+2)failures.push({app:'public',route,width,status:response.status(),...metrics});
   if(width===390&&['/','/pricing','/draftword','/draftsheet'].includes(route))await page.screenshot({path:`logs/responsive-${route.slice(1)||'home'}-390.png`});
   if(width===1440&& !['/login'].includes(route)){
    const meta=await page.evaluate(()=>({title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent))}));
    if(!meta.title||!meta.description||!meta.canonical||new URL(meta.canonical).pathname!==route||!meta.og||new URL(meta.og).pathname!==route)failures.push({route,metadata:meta});
   }
   results.push({app:'public',route,width,scroll:metrics.scroll});
  }
  await writeFile('logs/responsive-public-progress.json',JSON.stringify({results,failures,errors},null,2));console.log('Public viewport checked',width);
 }
 // Same palette and genuinely black dark mode in both apps.
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'load',timeout:180000});
 const publicLight=await page.evaluate(()=>Object.fromEntries(['--bg','--surface','--ink','--line'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])));
 await page.getByRole('button',{name:'Use dark theme',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.screenshot({path:'logs/public-dark-desktop.png'});
 const admin=await browser.newPage();admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto('http://127.0.0.1:3001',{waitUntil:'load',timeout:180000});
 await expect(admin.locator('html')).toHaveAttribute('data-theme','light',{timeout:60000});
 const adminLight=await admin.evaluate(()=>Object.fromEntries(['--bg','--surface','--ink','--line'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])));
 expect(adminLight).toEqual(publicLight);
 for(const width of [320,390,768,1024,1440]){await admin.setViewportSize({width,height:900});await expect(admin.getByRole('button',{name:'Sign in'})).toBeEnabled({timeout:60000});const scroll=await admin.evaluate(()=>document.documentElement.scrollWidth);if(scroll>width+2)failures.push({app:'admin-login',width,scroll});if(width===390)await admin.screenshot({path:'logs/admin-login-390.png'});}
 await admin.getByLabel('Password',{exact:true}).fill(process.env.DEMO_ADMIN_PASSWORD);
 await admin.getByRole('button',{name:'Sign in'}).click();
 await expect(admin.getByRole('navigation',{name:'Admin navigation'})).toBeVisible({timeout:60000});
 for(const width of [320,390,768,1024,1440]){
  await admin.setViewportSize({width,height:900});
  for(const tab of ['Tool catalog','Master inventory','Application health','Your account']){await admin.getByRole('button',{name:tab,exact:true}).click();const scroll=await admin.evaluate(()=>document.documentElement.scrollWidth);if(scroll>width+2)failures.push({app:'admin',tab,width,scroll});results.push({app:'admin',tab,width,scroll});}
  await admin.getByRole('button',{name:'Tool catalog',exact:true}).click();
  if(width===390||width===1440)await admin.screenshot({path:`logs/admin-catalog-${width}.png`});
 }
 await admin.getByRole('button',{name:'Use dark theme',exact:true}).click();
 await expect(admin.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await admin.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
 await admin.screenshot({path:'logs/admin-dark-desktop.png'});
 const robots=await (await page.request.get('http://127.0.0.1:3000/robots.txt')).text();
 expect(robots).toContain('OAI-SearchBot');expect(robots).toContain('Sitemap:');
 const adminRobots=await (await page.request.get('http://127.0.0.1:3001/robots.txt')).text();expect(adminRobots).toContain('Disallow: /');
 const sitemap=await (await page.request.get('http://127.0.0.1:3000/sitemap.xml')).text();
 expect(sitemap).toContain('/draftword');expect(sitemap).not.toContain('/account');
 const report={checks:results.length,matchingPalette:true,sitemapUrls:(sitemap.match(/<loc>/g)||[]).length,failures,errors};
 await writeFile('logs/responsive-seo-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(failures.length||errors.length)process.exitCode=1;
}finally{await browser.close();}
