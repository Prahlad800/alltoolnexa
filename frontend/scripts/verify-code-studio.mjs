import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {freshProject} from '../shared/code-playground.mjs';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3104',out='runtime-results/code-studio';
const widths=process.env.AUDIT_WIDTHS?process.env.AUDIT_WIDTHS.split(',').map(Number):[320,390,834,1440];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}),checks=[];
try{
 for(const width of widths){
  console.log(`Checking Code Studio at ${width}px`);
  const mobile=width<=768,context=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile,acceptDownloads:true});
  await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('alltoolnexa-language','en');});
  const page=await context.newPage(),errors=[];let premium=false,unavailable=false,runtimeRequests=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\.pack$|\.tar\.gz$/.test(request.url()))runtimeRequests++;});
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;let status=200,json={success:true};
   if(path==='/api/me'){status=unavailable?503:200;json=unavailable?{message:'Plan unavailable'}:{user_id:premium?'paid-user':null,plan:premium?'premium':'free',is_premium:premium,allowed_languages:premium?['en','hi','fr']:['en','hi']};}
   else if(path==='/api/auth/session'){status=401;json={message:'Sign in'};}
   else if(path==='/api/public/availability')json={disabledTools:[],disabledCategories:[]};
   await route.fulfill({status,json});
  });
  await page.goto(origin+'/code-editor',{waitUntil:'load'});
  const studio=page.getByRole('region',{name:'Code studio',exact:true}),dock=studio.getByRole('navigation',{name:'Studio panels'}),output=studio.getByLabel('Program output'),status=studio.locator('[role=status]'),editor=()=>studio.locator('.cm-content[contenteditable=true]');
  const pane=async name=>{if(mobile)await dock.getByRole('button',{name,exact:true}).click();};
  const edit=async code=>{await pane('Editor');await editor().waitFor();await editor().fill(code);};
  const run=async()=>{await studio.locator('header').first().waitFor();await studio.getByRole('button',{name:'Run',exact:true}).first().click();};
  const choose=async(id,label)=>{
   if(['web','python','c','cpp','java'].includes(id))await studio.getByRole('navigation',{name:'Language shortcuts'}).getByRole('button',{name:label,exact:true}).click();
   else{await studio.getByRole('button',{name:/^More languages/}).click();const dialog=page.getByRole('dialog',{name:'Your language. Your workspace.'});await dialog.getByRole('textbox',{name:'Find a language'}).fill(label);await dialog.getByRole('button',{name:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+', ')}).click();}
   await pane('Editor');await editor().waitFor();
  };
  await editor().waitFor();assert.equal(runtimeRequests,0,'Runtimes must load only when Run is pressed.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'workspace must fit the viewport');
  await run();const preview=page.frameLocator('iframe[title="Website preview"]');
  await preview.getByRole('button',{name:/Start creating/}).click();await expect(preview.getByRole('heading')).toHaveText('You made it happen.');
  await pane('Console');await expect(output).toContainText('Your JavaScript is running.');assert.equal(await studio.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  await pane('Editor');await preview.getByRole('heading').waitFor({state:'visible'});await studio.screenshot({path:`${out}/${width}-web.png`});
  const zipPromise=page.waitForEvent('download');await studio.getByRole('button',{name:'Download ZIP',exact:true}).click();const download=await zipPromise,zip=await JSZip.loadAsync(await readFile(await download.path()));
  for(const path of ['index.html','src/style.css','src/script.js','README.md','alltoolnexa.studio.json'])assert.ok(zip.file(path));
  checks.push({width,check:'web preview, real DOM interaction, console, sandbox and complete ZIP export',passed:true});
  await edit('<!doctype html><html><head><style>#paint { color: rgb(12, 34, 56); }</style><script type="application/json" id="data">{"ready":true}</script></head><body><h2 id="paint">Wait</h2><script>const data = JSON.parse(document.getElementById("data").textContent); document.getElementById("paint").textContent = data.ready ? "Inline HTML works" : "Failed";</script></body></html>');await run();await expect(preview.getByRole('heading')).toHaveText('Inline HTML works');assert.equal(await preview.locator('#paint').evaluate(node=>getComputedStyle(node).color),'rgb(12, 34, 56)');
  checks.push({width,check:'full HTML document retains head CSS and inert JSON scripts',passed:true});

  await choose('jsx','JavaScript JSX');await run();await expect(preview.getByRole('button',{name:'Clicked 0 times'})).toBeVisible();await preview.getByRole('button',{name:'Clicked 0 times'}).click();await expect(preview.getByRole('button',{name:'Clicked 1 times'})).toBeVisible();
  await choose('tsx','TypeScript JSX');await run();await expect(preview.getByRole('heading')).toHaveText('Build something great.');
  await studio.getByRole('group',{name:'Preview size'}).getByRole('button',{name:'Mobile',exact:true}).click();await expect(studio.locator('iframe')).toHaveCSS('max-width','360px');
  checks.push({width,check:'free JSX/TSX React hooks, typed component preview and device sizes',passed:true});
  await choose('json','JSON');await edit('{"valid":true}');await studio.getByRole('button',{name:'Validate',exact:true}).click();await expect(output).toContainText('Valid JSON');
  await edit('{bad json}');await studio.getByRole('button',{name:'Validate',exact:true}).click();await expect(studio.getByRole('alert')).toContainText(/JSON|Unexpected|property/);
  await choose('markdown','Markdown');await edit('# Safe Markdown\n\n<script>parent.document.body.dataset.escape = "bad"</script>\n\n**Hello**');await run();await expect(preview.getByRole('heading')).toHaveText('Safe Markdown');assert.equal(await page.evaluate(()=>document.body.dataset.escape),undefined);
  await choose('java','Java');await expect(studio.getByRole('button',{name:'Run',exact:true}).first()).toBeDisabled();await expect(editor()).toContainText('public class Main');
  checks.push({width,check:'JSON validation/errors, safe Markdown preview and honest Java editing-only state',passed:true});
  const programs=[['javascript','JavaScript','console.log("Answer:", 20 + 22);'],['typescript','TypeScript','const answer: number = 42; console.log("Answer:", answer);'],['python','Python','number = int(input())\nprint("Answer:", number * 2)'],['c','C','#include <stdio.h>\nint main(void){int n;scanf("%d",&n);printf("Answer: %d\\n",n*2);return 0;}'],['cpp','C++','#include <iostream>\n#include <vector>\nint main(){int n;std::cin>>n;std::vector<int> v={n,n};std::cout<<"Answer: "<<v[0]+v[1]<<std::endl;}']];
  for(const [id,label,code] of programs.filter(item=>!process.env.AUDIT_SMOKE||['javascript','typescript'].includes(item[0]))){
   console.log(`Executing ${width}px ${id}`);await choose(id,label);await edit(code);await pane('Console');await studio.getByRole('button',{name:'Standard input',exact:true}).click();await studio.getByRole('textbox',{name:'Standard input',exact:true}).fill('21\n');await run();
   await expect(status).toContainText('exit code 0',{timeout:60000});await expect(output).toContainText('Answer: 42');checks.push({width,check:id+' real browser execution'+(['python','c','cpp'].includes(id)?' with stdin':''),passed:true});
  }
  if(!process.env.AUDIT_SMOKE){await choose('c','C');await edit('int main( {');await run();await expect(status).toContainText('exit code 1',{timeout:60000});await expect(output).toContainText('error:');
  await choose('python','Python');await edit('raise ValueError("example error")');await run();await expect(status).toContainText('exit code 1',{timeout:60000});await expect(output).toContainText('ValueError: example error');
  await choose('javascript','JavaScript');await edit('while (true) {}');await run();await expect(status).toContainText('Running…',{timeout:60000});await studio.getByRole('button',{name:'Stop',exact:false}).first().click();await expect(status).toContainText('Stopped.');
  await edit('while (true) console.log("x".repeat(1000));');await run();await expect(studio.getByRole('alert')).toContainText('Output limit',{timeout:60000});assert.ok((await output.innerText()).length<=100000);
  checks.push({width,check:'compiler/runtime diagnostics, Stop and bounded output',passed:true});}
  await pane('Files');await studio.getByRole('button',{name:'New file',exact:true}).click();let dialog=page.getByRole('dialog',{name:'New file',exact:true});await dialog.getByRole('textbox',{name:'File or folder path'}).fill('src/helper.ts');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await edit('const answer:number=42;console.log(answer)');await studio.getByRole('button',{name:'Format',exact:true}).click();await expect(editor()).toContainText('const answer: number = 42;');
  await pane('Files');await studio.getByRole('button',{name:'Open src/helper.ts',exact:true}).hover();await studio.getByRole('button',{name:'Rename src/helper.ts',exact:true}).click();dialog=page.getByRole('dialog',{name:'Rename file',exact:true});await dialog.getByRole('textbox',{name:'File or folder path'}).fill('src/answer.ts');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await pane('Editor');await expect(studio.getByRole('tab',{name:'answer.ts',exact:false})).toHaveAttribute('aria-selected','true');
  await studio.getByRole('button',{name:/^More languages/}).click();dialog=page.getByRole('dialog',{name:'Your language. Your workspace.'});await expect(dialog.getByRole('button',{name:/, (?:Free|Premium locked)$/})).toHaveCount(76);await dialog.getByRole('textbox',{name:'Find a language'}).fill('Rust');await dialog.getByRole('button',{name:'Rust, Premium locked',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rust with Premium'})).toBeVisible();await page.getByRole('button',{name:'Keep using Free',exact:true}).click();
  await pane('Files');await studio.getByRole('button',{name:'Search project files',exact:true}).click();await studio.getByRole('textbox',{name:'Search files and code',exact:true}).fill('src/answer.ts');await expect(studio.getByRole('button',{name:'Open src/answer.ts',exact:true})).toBeVisible();await expect(studio.getByRole('button',{name:'Open index.html',exact:true})).toHaveCount(0);await studio.getByRole('textbox',{name:'Search files and code',exact:true}).fill('');await studio.getByRole('button',{name:'Search project files',exact:true}).click();await pane('Editor');checks.push({width,check:'create/rename files, formatting, project search, all 76 catalog entries and Free upgrade gate',passed:true});
  premium=true;await page.evaluate(()=>window.dispatchEvent(new Event('alltoolnexa-auth-changed')));await expect(studio.getByRole('link',{name:/Manage plan/})).toBeVisible();await choose('rust','Rust');await expect(editor()).toContainText('fn main()');await edit('fn main() { println!("Keep my paid draft"); }');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alltoolnexa-code-studio-v2')||'{}').files?.find(file=>file.path==='main.rs')?.content)).toContain('Keep my paid draft');
  premium=false;await page.evaluate(()=>window.dispatchEvent(new Event('alltoolnexa-auth-changed')));await expect(studio.getByText('This file needs Premium. Your saved source is preserved.',{exact:true})).toBeVisible();await expect(editor()).toHaveCount(0);
  const sourcePromise=page.waitForEvent('download');await studio.getByRole('button',{name:'Download source',exact:true}).click();const source=await sourcePromise;assert.equal(source.suggestedFilename(),'main.rs');assert.ok((await readFile(await source.path(),'utf8')).includes('Keep my paid draft'));
  await page.reload({waitUntil:'load'});await expect(studio.getByText('This file needs Premium. Your saved source is preserved.',{exact:true})).toBeVisible();
  premium=true;await page.evaluate(()=>window.dispatchEvent(new Event('alltoolnexa-auth-changed')));await editor().waitFor();await expect(editor()).toContainText('Keep my paid draft');
  unavailable=true;await page.evaluate(()=>window.dispatchEvent(new Event('alltoolnexa-auth-changed')));await expect(studio.getByText('This file needs Premium. Your saved source is preserved.',{exact:true})).toBeVisible();
  unavailable=false;premium=true;await page.evaluate(()=>window.dispatchEvent(new Event('alltoolnexa-auth-changed')));await editor().waitFor();
  checks.push({width,check:'server-verified Premium unlock; expiry/network failure locks editing without losing drafts or downloads',passed:true});
  await choose('tsx','TypeScript JSX');await run();await expect(preview.getByRole('button',{name:'Clicked 0 times'})).toBeVisible();await pane('Editor');await preview.getByRole('heading').waitFor({state:'visible'});await studio.screenshot({path:`${out}/${width}-premium-workspace.png`});
  // Import the real ZIP exported at the start, replacing the project atomically.
  await studio.getByRole('button',{name:'Import',exact:true}).click();dialog=page.getByRole('dialog',{name:'Import a project',exact:true});await expect(dialog).toBeVisible();const chooserPromise=page.waitForEvent('filechooser');await dialog.getByRole('button',{name:'Choose files',exact:true}).click();await (await chooserPromise).setFiles({name:download.suggestedFilename(),mimeType:'application/zip',buffer:await readFile(await download.path())});await expect(dialog).not.toBeVisible();await pane('Files');await expect(studio.getByRole('button',{name:'Open index.html',exact:true})).toBeVisible();await expect(studio.getByRole('button',{name:'Open main.rs',exact:true})).toHaveCount(0);
  checks.push({width,check:'real exported ZIP imports back with original files and active metadata',passed:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 }
 // A pre-upgrade draft restores in the new UI with exact source and input.
 const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage(),old=freshProject();old.language='python';old.files.python='print("Legacy draft")';old.stdin='saved input';
 await context.addInitScript(project=>{localStorage.setItem('alltoolnexa-language','en');localStorage.setItem('alltoolnexa-code-studio-v1',JSON.stringify(project));},old);
 await page.route('**/api/**',route=>route.fulfill({json:{plan:'free',is_premium:false,allowed_languages:['en','hi'],disabledTools:[],disabledCategories:[]}}));await page.goto(origin+'/code-editor');await expect(page.locator('.cm-content[contenteditable=true]')).toContainText('Legacy draft');
 checks.push({check:'legacy v1 local draft migrates in the browser',passed:true});await context.close();
 await writeFile(out+'/results.json',JSON.stringify(checks,null,2));console.log(`PASS: ${checks.length} Code Studio checks. Runtime execution and downloads were real; only account APIs were mocked.`);
}finally{await browser.close();}
