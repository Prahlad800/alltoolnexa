'use client';
import {T} from '@/components/LanguageProvider';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from '@/components/ManagedLink';
import {apiRequest,getSession} from '../../shared/api-client.mjs';
import styles from './PricingSection.module.css';
let checkoutScript;
function loadCheckout(){
 if(window.Razorpay)return Promise.resolve();
 if(!checkoutScript)checkoutScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=()=>{checkoutScript=null;script.remove();reject(Error('Checkout could not load. Please retry.'));};document.head.appendChild(script);});
 return checkoutScript;
}
export default function PlanButton({plan,billingCycle='monthly',locked=false,onBusyChange}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const changeBusy=value=>{setBusy(value);onBusyChange?.(value?plan.id:null);};
 async function pay(){
  changeBusy(true);setError('');
  try{
   const session=await getSession();if(!session){changeBusy(false);router.push('/login');return;}
   const config=await apiRequest('/api/billing/plans');
   if(!config.checkoutEnabled)throw Error('Payments are not configured yet. Please try again later.');
   if(billingCycle==='yearly'&&!config.billingCycles?.includes('yearly'))throw Error('Annual checkout is not available yet. You can choose monthly billing; no payment was taken.');
   await loadCheckout();
   const order=await apiRequest('/api/billing/orders',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify({planId:plan.id,billingCycle})});
   const expectedAmount=(billingCycle==='yearly'?plan.annualPrice:plan.price)*100;
   if(order.amount!==expectedAmount||(order.billingCycle||'monthly')!==billingCycle)throw Error('Pricing changed or the billing cycle did not match. Reload this page and retry; no payment was taken.');
   const checkout=new window.Razorpay({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'AllToolNexa',description:plan.name+(order.billingCycle==='yearly'?' — 12 months, manual renewal':' — one month, manual renewal'),prefill:{email:session.user.email},handler:async response=>{try{await apiRequest('/api/billing/verify',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify(response)});window.dispatchEvent(new Event('alltoolnexa-auth-changed'));router.push('/dashboard');}catch(cause){setError(cause.message+' Contact support with your payment ID: '+response.razorpay_payment_id);}finally{changeBusy(false);}},modal:{ondismiss:()=>changeBusy(false)}});
   checkout.on('payment.failed',()=>{setError('Payment failed. You can retry checkout.');changeBusy(false);});checkout.open();
  }catch(cause){setError(cause.message);changeBusy(false);}
 }
 if(plan.price===0)return <Link className={styles.planButton} href="/signup"><T>Get Started</T></Link>;
 return <><button type="button" disabled={busy||locked} className={`${styles.planButton} ${plan.popular?styles.featuredButton:''}`} onClick={pay}>{busy?<T>Connecting…</T>:<><T>Choose</T> {plan.name} · <T>{billingCycle==='yearly'?'Annual':'Monthly'}</T></>}</button>{error&&<p role="alert">{error}</p>}</>;
}
