import assert from 'node:assert/strict';
import {tools,categories,aliases} from '../shared/catalog.mjs';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3100';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
let checked=0;
async function page(path){const response=await fetch(origin+path);assert.equal(response.status,200,path);checked++;return response.text();}
const home=await page('/');assert.ok(home.includes('Small tools.'));assert.ok(home.includes('application/ld+json'));
for(const path of ['/tools','/tools?q=PDF','/categories','/about','/contact','/privacy','/terms','/disclaimer'])await page(path);
const sitemap=await page('/sitemap.xml');assert.equal((sitemap.match(/<loc>/g)||[]).length,tools.length+categories.length+8);
const robots=await page('/robots.txt');assert.ok(robots.includes('Sitemap:'));
for(const category of categories)await page('/categories/'+category.id);
let next=0;
async function worker(){while(next<tools.length){const tool=tools[next++],html=await page('/tools/'+tool.id);assert.ok(html.includes(escape(tool.name)),tool.id);assert.ok(html.includes('rel="canonical"'),tool.id);assert.ok(html.includes('application/ld+json'),tool.id);assert.ok(html.includes('Your input')||tool.kind==='timer',tool.id);}}
await Promise.all(Array.from({length:4},worker));
const missing=await fetch(origin+'/tools/this-tool-does-not-exist');assert.equal(missing.status,404);
for(const alias of ['json-beautifier','home-loan-emi','cgpa-calculator']){const response=await fetch(origin+'/tools/'+alias,{redirect:'manual'});assert.equal(response.status,308,alias);assert.equal(response.headers.get('location'),'/tools/'+aliases[alias]);}
console.log(`${checked} pages/SEO files returned HTTP 200; all ${tools.length} tools checked. Unknown tools return 404; sample aliases redirect to canonical pages.`);
