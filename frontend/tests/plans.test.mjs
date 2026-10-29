import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public plan snapshot matches server prices and quotas',()=>{
 const local=JSON.parse(readFileSync(new URL('../shared/plans.json',import.meta.url)));
 const server=JSON.parse(readFileSync(new URL('../../backend/data/plans.json',import.meta.url)));
 assert.deepEqual(local,server);
});

import {planPricing,rupees} from '../shared/plan-pricing.mjs';
test('annual totals, equivalents and discounts use the exact server-owned prices',()=>{
 const plans=JSON.parse(readFileSync(new URL('../shared/plans.json',import.meta.url)));
 for(const [id,amount,monthly,saving,percent] of [['basic',349,'₹29.08',119,25.4],['pro',949,'₹79.08',119,11.1],['premium',1599,'₹133.25',189,10.6],['premium-plus',2000,'₹166.67',388,16.2]]){
  const plan=plans.find(p=>p.id===id),quote=planPricing(plan,'yearly');assert.equal(quote.amount,amount);assert.equal(rupees(quote.monthlyEquivalent,{decimals:true}),monthly);assert.equal(quote.saving,saving);assert.equal(quote.discountPercent,percent);assert.equal(planPricing(plan).amount,plan.price);
 }
 assert.equal(planPricing(plans[0],'yearly').discountPercent,0);assert.throws(()=>planPricing(plans[1],'invalid'));
});
