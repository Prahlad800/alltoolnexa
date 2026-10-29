export const BILLING_CYCLES=['monthly','yearly'];
export const rupees=(amount,{decimals=false}={})=>'₹'+new Intl.NumberFormat('en-IN',{minimumFractionDigits:decimals?2:0,maximumFractionDigits:2}).format(amount);
export function planPricing(plan,cycle='monthly'){
 if(!BILLING_CYCLES.includes(cycle))throw Error('Choose monthly or yearly billing.');
 const annualBaseline=plan.price*12,saving=Math.max(0,annualBaseline-plan.annualPrice);
 return {amount:cycle==='yearly'?plan.annualPrice:plan.price,monthlyEquivalent:plan.annualPrice/12,annualBaseline,saving,discountPercent:annualBaseline?Number((saving*100/annualBaseline).toFixed(1)):0};
}
