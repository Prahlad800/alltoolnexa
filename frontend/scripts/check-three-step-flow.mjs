import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:60000});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message);});page.on('dialog',d=>d.accept());
try{
 await page.goto('http://127.0.0.1:3000/tools/word-counter',{waitUntil:'load',timeout:180000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('.flow-caption')).toContainText('Step 1 of 3');
 await page.locator('.tool-form textarea').fill('One two three');
 await page.locator('.tool-form button.primary').click();
 await expect(page.locator('.flow-caption')).toContainText('Step 3 of 3');
 await expect(page.locator('.result-metrics>div').filter({has:page.locator('dt',{hasText:/^Words$/})}).locator('dd')).toHaveText('3');
 await expect(page.locator('.tool-form')).not.toBeVisible();
 await page.screenshot({path:'logs/flow-preview-desktop.png',timeout:60000});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:false}).click();console.log('Download:',(await download).suggestedFilename());
 await page.getByRole('button',{name:'Change input',exact:true}).click();
 await expect(page.locator('.flow-caption')).toContainText('Step 1 of 3');
 await expect(page.locator('.tool-form textarea')).toHaveValue('One two three');
 await page.getByRole('button',{name:'Use dark theme',exact:true}).click();
 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:900});
  await expect(page.locator('.header-search')).toBeVisible();
  await expect(page.locator('.theme-toggle')).toBeVisible();
  await expect(page.locator('.header-cta')).toBeVisible();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow at '+width);
 }
 await page.screenshot({path:'logs/flow-header-mobile.png',timeout:60000});
 await page.goto('http://127.0.0.1:3000/tools/image-compressor',{waitUntil:'domcontentloaded',timeout:120000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('.tool-form button.primary').click();
 await expect(page.getByRole('alert').filter({hasText:'Choose a file first.'})).toBeVisible();
 await expect(page.locator('.flow-caption')).toContainText('Step 1 of 3');
 console.log(JSON.stringify({inputPreviewBack:'passed',realWordCount:3,mobileHeader:'all controls visible at 320/390/768px',validation:'passed',errors}));
 if(errors.length)throw Error('Browser errors');
}finally{await browser.close();}
