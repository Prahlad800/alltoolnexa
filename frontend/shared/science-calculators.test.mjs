import test from 'node:test';
import assert from 'node:assert/strict';
import {scienceCalculators,calculateScience} from './science-calculators.mjs';
import {getTool,defaults,evaluate,resolveTool} from './catalog.mjs';

// Independently hand-computable vectors. Every tool has at least five known
// answers as well as field and model-domain rejection checks below.
import {vectors} from './science-calculators.cases.mjs';

function close(actual,expected) {
 if(typeof expected==='object'){for(const key of Object.keys(expected))close(actual[key],expected[key]);return;}
 assert.ok(Math.abs(actual-expected)<=Math.max(1e-12,Math.abs(expected)*1e-10),`${actual} != ${expected}`);
}
for(const def of scienceCalculators)test(def.name,async t=>{
 const tool=getTool(def.id);assert.equal(tool.name,def.name);assert.equal(resolveTool(def.id),tool);
 assert.equal(vectors[def.id].length,5);
 for(const [index,[input,answer]] of vectors[def.id].entries())await t.test(`known answer ${index+1}`,()=>close(evaluate(def.id,input),answer));
 await t.test('default example is finite',()=>assert.notEqual(evaluate(def.id,defaults(tool)),undefined));
 for(const field of def.fields) {
  if(field.type==='number')for(const value of ['',NaN,Infinity,1e101])assert.throws(()=>calculateScience(def,{...defaults(tool),[field.key]:value}));
  if(field.type==='number'&&field.min===0)assert.throws(()=>calculateScience(def,{...defaults(tool),[field.key]:-1}));
  if(field.strict)assert.throws(()=>calculateScience(def,{...defaults(tool),[field.key]:0}));
  if(field.type==='textarea')for(const value of ['', '1', '1 NaN', '1 1e101',Array(1001).fill('1').join(' ')])assert.throws(()=>calculateScience(def,{...defaults(tool),[field.key]:value}));
 }
});
test('model-specific undefined cases and finite result protection',()=>{
 const rejects=[['geometric-mean-calculator',{text:'0 1'}],['harmonic-mean-calculator',{text:'-1 2'}],['covariance-calculator',{x:'1 2',y:'1 2 3',mode:'sample'}],['covariance-calculator',{x:'1 2',y:'1 2',mode:'other'}],['correlation-coefficient-calculator',{x:'1 1',y:'2 3'}],['linear-regression-calculator',{x:'1 1',y:'2 3'}],['torque-calculator',{force:1,radius:1,angle:181}],['transformer-calculator',{primary:2,primaryTurns:1.5,secondaryTurns:2}],['mole-fraction-calculator',{component:0,other:0}],['pressure-calculator',{force:1e100,area:1e-300}]];
 for(const [id,input] of rejects)assert.throws(()=>evaluate(id,input),undefined,id);
});
