import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
process.loadEnvFile('../backend/.env');
const browser=await chromium.launch({channel:'msedge',headless:true});
const email=`browser-${Date.now()}@example.com`,password='Browser-only-long-password!2026',errors=[];
try{
 await writeFile('logs/jwt-login-fixture.json',JSON.stringify({email}));
 const context=await browser.newContext({viewport:{width:390,height:900}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'load',timeout:180000});
 await expect(page.locator('.user-navigation').getByRole('link',{name:'Login',exact:true})).toBeVisible();
 await page.locator('.user-navigation').getByRole('link',{name:'Sign up',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeEnabled({timeout:60000});
 await page.getByLabel('Email address',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByLabel('Confirm password',{exact:true}).fill(password);
 await page.screenshot({path:'logs/signup-mobile.png'});
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page).toHaveURL(/\/account$/,{timeout:60000});
 await expect(page.getByText(email,{exact:true})).toBeVisible();
 await expect(page.locator('.user-navigation').getByRole('link',{name:'My account',exact:true})).toBeVisible();
 const userCookie=(await context.cookies()).find(c=>c.name==='alltoolnexa_user_session');
 expect(userCookie?.httpOnly).toBe(true);expect(userCookie?.value.split('.').length).toBe(3);
 expect(await page.evaluate(()=>document.cookie)).not.toContain(userCookie.value);
 const denial=await page.request.get('http://127.0.0.1:5000/api/admin/catalog');expect(denial.status()).toBe(401);
 await page.reload({waitUntil:'load'});await expect(page.getByText(email,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page).toHaveURL(/\/login$/,{timeout:60000});
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
 await page.getByLabel('Email address',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill('wrong-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#auth-error')).toContainText('Incorrect');
 await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/account$/,{timeout:60000});
 // A simultaneous admin sign-in must not replace the user's cookie/session.
 const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto('http://127.0.0.1:3001/',{waitUntil:'load',timeout:180000});
 await expect(admin.getByRole('button',{name:'Sign in'})).toBeEnabled({timeout:60000});
 await admin.getByLabel('Password',{exact:true}).fill(process.env.DEMO_ADMIN_PASSWORD);
 await admin.getByRole('button',{name:'Sign in'}).click();await expect(admin.getByRole('navigation',{name:'Admin navigation'})).toBeVisible({timeout:60000});
 expect((await context.cookies()).find(c=>c.name==='alltoolnexa_admin_session')?.httpOnly).toBe(true);
 await page.reload({waitUntil:'load'});await expect(page.getByText(email,{exact:true})).toBeVisible();
 await admin.screenshot({path:'logs/admin-jwt-mobile.png'});
 // Verify both guest links and the search bar fit the header at every supported size.
 const guest=await browser.newContext();const preview=await guest.newPage();
 for(const width of [320,390,768,1024,1440]){await preview.setViewportSize({width,height:900});for(const route of ['/','/signup','/login']){await preview.goto('http://127.0.0.1:3000'+route,{waitUntil:'load',timeout:180000});await expect(preview.getByRole('search',{name:'Search all tools'})).toBeVisible();expect(await preview.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await expect(preview.locator('.user-navigation').getByRole('link',{name:'Login',exact:true})).toBeVisible();await expect(preview.locator('.user-navigation').getByRole('link',{name:'Sign up',exact:true})).toBeVisible();if(width===390&&route==='/')await preview.screenshot({path:'logs/user-header-mobile.png'});}}
 await preview.setViewportSize({width:390,height:900});await preview.getByRole('button',{name:'Use dark theme',exact:true}).click();await preview.screenshot({path:'logs/login-dark-mobile.png'});
 const report={signup:true,userLogin:true,wrongPasswordRejected:true,refresh:true,adminRoleProtected:true,simultaneousSessions:true,httpOnlyJWT:true,responsiveViewports:5,errors};
 await writeFile('logs/jwt-login-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(errors.length)process.exitCode=1;
 await context.close();await guest.close();
}finally{await browser.close();}
