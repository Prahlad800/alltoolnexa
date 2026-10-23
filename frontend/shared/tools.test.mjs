import test from 'node:test';
import assert from 'node:assert/strict';
import {tools,categories,defaults,evaluate,aliases,getTool,resolveTool} from './catalog.mjs';
import {csvRows,date,number} from './core.mjs';

test('catalog entries have unique IDs, valid categories and working examples',async t=>{
 assert.equal(new Set(tools.map(t=>t.id)).size,tools.length);
 for(const tool of tools){assert.ok(categories.some(c=>c.id===tool.category));assert.ok(tool.formula.length>15);assert.equal(new Set(tool.fields.map(f=>f.key)).size,tool.fields.length);if(tool.kind==='standard')await t.test(tool.id,async()=>{const result=await evaluate(tool.id,defaults(tool));assert.notEqual(result,undefined);assert.notEqual(result,null);if(typeof result==='number')assert.ok(Number.isFinite(result));});}
});
test('reference arithmetic and geometry results',()=>{
 for(const[id,input,expected]of[
  ['percentage-calculator',{a:200,b:15},30],['percentage-change',{a:80,b:100},25],
  ['percentage-error',{a:9.8,b:10},2],['ratio-simplifier',{a:24,b:36},'2:3'],
  ['fraction-simplifier',{a:12,b:18},'2/3'],['decimal-to-fraction',{a:.375},'3/8'],
  ['average-calculator',{text:'2,4,6'},4],['median-calculator',{text:'9,1,5,3'},4],
  ['variance-calculator',{text:'2,4,4,4,5,5,7,9'},4],['standard-deviation',{text:'2,4,4,4,5,5,7,9'},2],
  ['lcm-calculator',{text:'12,18'},36],['hcf-gcd-calculator',{text:'48 18'},6],
  ['factorial-calculator',{a:0},1],['combination-calculator',{a:10,b:3},120],['permutation-calculator',{a:10,b:3},720],
  ['pythagorean-calculator',{a:3,b:4},5],['triangle-area',{a:8,b:5},20],['rectangle-area',{a:8,b:5},40],
  ['prime-number-checker',{a:1},'Not prime'],['prime-number-checker',{a:97},'Prime'],['prime-factorization',{a:360},'2 × 2 × 2 × 3 × 3 × 5'],
 ])assert.equal(evaluate(id,input),expected,id);
 assert.throws(()=>evaluate('triangle-perimeter',{a:1,b:2,c:3}),/triangle/);
 assert.throws(()=>evaluate('ratio-simplifier',{a:0,b:0}),/zero/);
});
test('student and salary edge cases',()=>{
 assert.equal(evaluate('required-attendance-calculator',{a:60,b:90,c:75}),30);
 assert.equal(evaluate('required-attendance-calculator',{a:90,b:90,c:100}),0);
 assert.equal(evaluate('bunk-calculator',{a:80,b:100,c:75}),6);
 assert.equal(evaluate('weighted-marks-calculator',{text:'80,90,70',weights:'3,4,3'}),81);
 assert.equal(evaluate('salary-per-hour',{a:35200,b:22,c:8}),200);
 assert.equal(evaluate('salary-hike-calculator',{a:30000,b:20}),36000);
 assert.equal(evaluate('working-hours-calculator',{start:'22:00',end:'06:00',a:30}),'7h 30m (7.5 hours)');
 assert.throws(()=>evaluate('marks-percentage-calculator',{a:101,b:100}),/exceed/);
 assert.throws(()=>evaluate('weighted-marks-calculator',{text:'80,90',weights:'1'}),/weight/);
 assert.throws(()=>evaluate('salary-per-day',{a:1000,b:0}),/greater than zero/);
});
test('finance zero-interest loans and business metrics',()=>{
 assert.match(evaluate('emi-calculator',{a:12000,b:0,c:12}),/Monthly EMI: 1000/);
 assert.match(evaluate('emi-calculator',{a:500000,b:9,c:60}),/10379\.1776/);
 const schedule=evaluate('loan-repayment-schedule',{a:12000,b:0,c:12});
 assert.equal(schedule.split('\n').length,13);assert.match(schedule.split('\n').at(-1),/0\.00$/);
 assert.equal(evaluate('simple-interest-calculator',{a:10000,b:8,c:3}),2400);
 assert.equal(evaluate('discount-calculator',{a:1000,b:20}),800);
 assert.equal(evaluate('selling-price-calculator',{a:100,b:20}),125);
 assert.equal(evaluate('sip-mathematical-calculator',{a:1000,b:0,c:12}),12000);
 assert.equal(evaluate('ctr-calculator',{a:250,b:10000}),2.5);
 assert.equal(evaluate('cpm-calculator',{a:500,b:10000}),50);
 assert.equal(evaluate('ai-api-cost-calculator',{a:1000000,b:1,c:500000,d:4}),3);
 assert.throws(()=>evaluate('break-even-calculator',{a:1000,b:10,c:10}),/exceed/);
});
test('UTC date arithmetic, leap days and midnight shifts',()=>{
 assert.equal(evaluate('date-difference-calculator',{start:'2024-02-28',end:'2024-03-01'}),2);
 assert.equal(evaluate('business-days-calculator',{start:'2026-10-19',end:'2026-10-26'}),5);
 assert.equal(evaluate('age-calculator',{start:'2000-02-29',end:'2025-02-28'}),'25 years, 0 months, 0 days');
 assert.equal(evaluate('add-days-to-date',{start:'2024-02-28',a:2}),'2024-03-01');
 assert.equal(evaluate('week-number-calculator',{start:'2021-01-01'}),'2020-W53');
 assert.throws(()=>date('2023-02-29'),/valid/);
});
test('exact conversions and color contrast',()=>{
 assert.equal(evaluate('celsius-to-fahrenheit',{a:0}),32);
 assert.equal(evaluate('fahrenheit-to-celsius',{a:212}),100);
 assert.equal(evaluate('inch-to-cm',{a:1}),2.54);
 assert.equal(evaluate('acre-to-sq-ft',{a:1}),43560);
 assert.equal(evaluate('hex-to-rgb',{color:'#ffffff'}),'rgb(255, 255, 255)');
 assert.equal(evaluate('color-contrast-calculator',{foreground:'#000000',background:'#ffffff'}).ratio,21);
 assert.equal(evaluate('aspect-ratio-calculator',{a:1920,b:1080}),'16:9');
 assert.throws(()=>evaluate('celsius-to-kelvin',{a:-274}),/at least/);
});
test('Unicode, data round trips, hostile text and preserved CSV quoting',()=>{
 const message='नमस्ते 🌿 café';
 const encoded=evaluate('base64-encoder',{text:message});assert.equal(evaluate('base64-decoder',{text:encoded}),message);
 assert.equal(evaluate('character-counter',{text:'🌿'} )['Unicode characters'],1);
 assert.equal(evaluate('html-escape-tool',{text:'<script>"x"</script>'}),'&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
 const input=[{name:'Asha, R.',note:'line 1\nline 2'},{name:'"Ravi"',note:'hello'}];
 const csv=evaluate('json-to-csv',{text:JSON.stringify(input)});assert.deepEqual(JSON.parse(evaluate('csv-to-json',{text:csv})),input);
 assert.deepEqual(csvRows('a,b\r\n"hello, world","say ""hi"""'),[['a','b'],['hello, world','say "hi"']]);
 assert.throws(()=>evaluate('json-validator',{text:'{"broken":}'}),SyntaxError);
 assert.throws(()=>evaluate('csv-to-json',{text:'a,a\n1,2'}),/unique/);
 assert.equal(evaluate('binary-to-decimal',{text:'11111111'}),'255');
 assert.equal(evaluate('decimal-to-binary',{text:'9007199254740993'}),BigInt('9007199254740993').toString(2));
 assert.throws(()=>evaluate('binary-to-decimal',{text:'102'}),/Invalid/);
 assert.throws(()=>evaluate('url-parser',{text:'javascript:alert(1)'}),/http/);
});
test('secure utilities satisfy structural invariants',async()=>{
 const password=evaluate('password-generator',{a:24,symbols:'yes'});assert.equal(password.length,24);assert.match(password,/[A-Z]/);assert.match(password,/[a-z]/);assert.match(password,/[2-9]/);assert.match(password,/[!@#$%^&*()_+=-]/);
 assert.match(evaluate('uuid-generator',{a:1}),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.equal(await evaluate('sha256-generator',{text:'abc'}),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.equal(evaluate('random-token-generator',{a:32}).length,64);
});
test('aliases resolve to existing pages without publishing unfinished routes',()=>{for(const[target,id]of Object.entries(aliases)){assert.ok(getTool(id),target);assert.equal(resolveTool(target).id,id);}});

test('second-batch calculators handle signed fractions, GPA, prepayments and timezones',()=>{
 assert.equal(evaluate('fraction-calculator',{first:'-1/2',operation:'+',second:'1/3'}),'-1/6');
 assert.equal(evaluate('fraction-simplifier',{a:-12,b:-18}),'2/3');
 assert.equal(evaluate('fraction-to-decimal',{a:1,b:-2}),-.5);
 assert.equal(evaluate('percentage-change',{a:-100,b:-80}),20);
 assert.equal(evaluate('gpa-calculator',{text:'8,9,7',credits:'3,4,3',a:10}),8.1);
 assert.equal(evaluate('months-between-dates',{start:'2026-01-15',end:'2026-03-14'}),1);
 assert.equal(evaluate('loan-amount-calculator',{a:1000,b:0,c:12}),12000);
 assert.equal(evaluate('loan-tenure-calculator',{a:12000,b:0,c:1000}),12);
 const prepay=evaluate('prepayment-calculator',{a:12000,b:0,c:12,d:3,prepay:3000});assert.equal(prepay.newTenureMonths,9);assert.equal(prepay.interestSaved,0);
 assert.equal(evaluate('timezone-offset-calculator',{first:'+05:30',second:'+00:00'}),'-330 minutes');
 assert.equal(evaluate('time-subtraction',{first:'02:15',second:'03:00'}),'-0:45');
 assert.throws(()=>evaluate('loan-tenure-calculator',{a:100000,b:12,c:100}),/exceed/);
 assert.throws(()=>evaluate('scientific-calculator',{a:90,operation:'tan',unit:'degrees'}),/undefined/);
});
