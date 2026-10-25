import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:3000/pricing',{waitUntil:'networkidle',timeout:120000});
 await expect(page.getByRole('link',{name:'Get Started',exact:false})).toHaveAttribute('href','/tools');
 for(const name of ['Basic','Pro','Premium','Premium Plus']){
  await page.getByRole('button',{name:`Choose ${name} →`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:`${name} plan`,exact:true});
  await expect(dialog).toBeVisible({timeout:30000});
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await expect(dialog).not.toBeVisible();
 }
 console.log('PASS: Free tools link and all four paid-plan dialogs.');
}finally{await browser.close();}
