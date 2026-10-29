import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import JSZip from 'jszip';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:3102',out='runtime-results/code-editor';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const checks=[],widths=process.env.AUDIT_WIDTHS?process.env.AUDIT_WIDTHS.split(',').map(Number):[320,390,1440];
try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,acceptDownloads:true});
  await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('alltoolnexa-language','en');});
  const page=await context.newPage(),errors=[];let runtimeRequests=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(/\.pack$|\.tar\.gz$/.test(request.url()))runtimeRequests++;});
  await page.goto(origin+'/code-editor',{waitUntil:'load'});
  const studio=page.getByRole('region',{name:'Code studio'}),output=studio.getByLabel('Program output'),status=studio.getByRole('status'),selection=studio.getByRole('combobox',{name:'Language',exact:true});
  const editor=()=>page.locator('.cm-content[contenteditable=true]');
  const edit=async code=>{if(width<768)await studio.getByRole('tab',{name:'Editor',exact:true}).click();await editor().waitFor();await editor().fill(code);};
  const run=async()=>{await studio.getByRole('button',{name:'Run',exact:true}).click();};
  const choose=async language=>{await selection.selectOption(language);if(width<768)await studio.getByRole('tab',{name:'Editor',exact:true}).click();await editor().waitFor();};
  await editor().waitFor();
  assert.equal(runtimeRequests,0,'Opening the editor must not download language runtimes.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
  await run();
  const preview=page.frameLocator('iframe[title="Website preview"]');
  await preview.getByRole('button',{name:'Say hello'}).click();
  await expect(preview.getByRole('heading')).toHaveText('Hello, AllToolNexa!');
  await expect(output).toContainText('Your JavaScript is running.');
  assert.equal(await page.locator('iframe[title="Website preview"]').getAttribute('sandbox'),'allow-scripts');
  if(width!==320)await page.screenshot({path:`${out}/${width}-web-preview.png`});
  const downloadPromise=page.waitForEvent('download');await studio.getByRole('button',{name:'Download project'}).click();
  const download=await downloadPromise;const zip=await JSZip.loadAsync(await readFile(await download.path()));
  for(const name of ['index.html','style.css','script.js'])assert.ok(zip.file(name));
  assert.ok((await zip.file('index.html').async('string')).includes('Make something great.'));
  checks.push({width,check:'HTML/CSS/JS preview, interactivity, console and real ZIP export',passed:true});
  if(width<768)await studio.getByRole('tab',{name:'Editor',exact:true}).click();
  await studio.getByRole('tab',{name:'index.html',exact:true}).click();await edit('<h2 id="test">Preview test</h2>');
  await studio.getByRole('tab',{name:'style.css',exact:true}).click();await edit('body { background: rgb(255, 240, 245); }');
  await studio.getByRole('tab',{name:'script.js',exact:true}).click();await edit('document.querySelector("#test").textContent = "Three files work"; try { parent.document.body.dataset.previewEscape = "bad"; } catch { console.log("Parent access blocked"); }');
  await run();await expect(preview.getByRole('heading')).toHaveText('Three files work');
  assert.equal(await preview.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 240, 245)');
  await expect(output).toContainText('Parent access blocked');
  assert.equal(await page.evaluate(()=>document.body.dataset.previewEscape),undefined);
  checks.push({width,check:'three-file editing and parent-document isolation',passed:true});
  const programs=[
   ['javascript','console.log("Answer:", [20, 22].reduce((a,b)=>a+b,0));'],
   ['python','number = int(input())\nprint("Answer:", number * 2)'],
   ['c','#include <stdio.h>\nint main(void) { int n; scanf("%d", &n); printf("Answer: %d\\n", n * 2); return 0; }'],
   ['cpp','#include <iostream>\n#include <vector>\nint main() { int n; std::cin >> n; std::vector<int> v = {n, n}; std::cout << "Answer: " << v[0] + v[1] << std::endl; }'],
  ];
  for(const [language,code] of programs){
   console.log(`Checking ${width}px ${language}`);await choose(language);await edit(code);
   await studio.getByRole('textbox',{name:/Standard input/}).fill('21\n');
   await run();await expect(status).toContainText('exit code 0',{timeout:60000});await expect(output).toContainText('Answer: 42');
   checks.push({width,check:language+' real WASM execution'+(language==='javascript'?'':' with stdin'),passed:true});
   if(language==='cpp'&&width!==320)await page.screenshot({path:`${out}/${width}-cpp-output.png`});
  }
  await choose('c');await edit('int main( {');await run();await expect(status).toContainText('exit code 1',{timeout:60000});await expect(output).toContainText('error:');
  await choose('python');await edit('raise ValueError("example error")');await run();await expect(status).toContainText('exit code 1',{timeout:60000});await expect(output).toContainText('ValueError: example error');
  checks.push({width,check:'C compiler diagnostics and Python runtime errors',passed:true});
  await choose('javascript');await edit('while (true) {}');await run();await expect(status).toContainText('Running…',{timeout:60000});
  await studio.getByRole('button',{name:'Stop',exact:true}).click();await expect(status).toContainText('Stopped.');await expect(studio.getByRole('button',{name:'Run',exact:true})).toBeEnabled();
  await edit('while (true) console.log("x".repeat(1000));');await run();await expect(studio.getByRole('alert')).toContainText('Output limit',{timeout:60000});assert.ok((await output.innerText()).length<=100000);
  checks.push({width,check:'infinite-loop cancellation and bounded console output',passed:true});
  await choose('python');await edit('print("Saved draft")');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alltoolnexa-code-studio-v1')||'{}').files?.python)).toBe('print("Saved draft")');
  await page.reload({waitUntil:'load'});await expect(selection).toHaveValue('python');await expect(editor()).toContainText('Saved draft');
  const sourcePromise=page.waitForEvent('download');await studio.getByRole('button',{name:'Download source'}).click();const source=await sourcePromise;
  assert.equal(source.suggestedFilename(),'main.py');assert.equal(await readFile(await source.path(),'utf8'),'print("Saved draft")');
  checks.push({width,check:'local draft restoration and exact source download',passed:true});
  if(width!==320)await page.screenshot({path:`${out}/${width}-editor.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify(checks,null,2));console.log(`PASS: ${checks.length} checks on ${widths.join(', ')}px; every language executed locally with real runtimes, not mocked.`);
}finally{await browser.close();}
