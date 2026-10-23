import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTool,evaluate,defaults,tools} from '../shared/catalog.mjs';
import {suggestTools} from '../src/lib/search.mjs';
import {fieldErrors,resultMetrics,actionLabel} from '../src/lib/workbench-ux.mjs';
test('CGPA respects institutional scales and rejects impossible percentages',()=>{
 assert.equal(evaluate('cgpa-to-percentage',{a:8.5,b:9.5,scale:10}),80.75);
 assert.equal(evaluate('cgpa-to-percentage',{a:3,b:25,scale:4}),75);
 assert.throws(()=>evaluate('cgpa-to-percentage',{a:100,b:9.5,scale:10}),/between/);
 assert.throws(()=>evaluate('cgpa-to-percentage',{a:10,b:20,scale:10}),/exceeds 100/);
});
test('typo recovery suggests relevant tools with bounded query work',()=>{
 assert.ok(suggestTools(tools,'pdf marg').some(t=>t.id==='pdf-merge'));
 assert.deepEqual(suggestTools(tools,'x'.repeat(1000)),[]);
 assert.deepEqual(suggestTools(tools,''),[]);
});
test('form validation identifies fields and metrics preserve raw output semantics',()=>{
 const tool=resolveTool('cgpa-to-percentage');
 assert.deepEqual(fieldErrors(tool,defaults(tool)),{});
 assert.ok(fieldErrors(tool,{a:'',b:'abc',scale:0}).scale);
 assert.deepEqual(resultMetrics({Words:2,Lines:1}),[['Words',2],['Lines',1]]);
 assert.equal(resultMetrics({nested:{a:1}}),null);
 assert.equal(actionLabel(resolveTool('word-counter')),'Count words');
});
