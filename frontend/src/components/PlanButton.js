'use client';

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

export default function PlanButton({plan}){

 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');

 async function pay(){setBusy(true);setError('');try{

  const session=await getSession();if(!session){router.push('/login');return;}

  const config=await apiRequest('/api/billing/plans');if(!config.checkoutEnabled)throw Error('Payments are not configured yet. Please try again later.');

  await loadCheckout();

  const order=await apiRequest('/api/billing/orders',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify({planId:plan.id})});

  const checkout=new window.Razorpay({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'AllToolNexa',description:plan.name+' — one month, manual renewal',prefill:{email:session.user.email},handler:async response=>{try{await apiRequest('/api/billing/verify',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken},body:JSON.stringify(response)});router.push('/dashboard');}catch(e){setError(e.message+' Contact support with your payment ID: '+response.razorpay_payment_id);}finally{setBusy(false);}},modal:{ondismiss:()=>setBusy(false)}});

  checkout.on('payment.failed',()=>{setError('Payment failed. You can retry checkout.');setBusy(false);});checkout.open();

 }catch(e){setError(e.message);setBusy(false);}}

 if(plan.price===0)return <Link className={styles.planButton} href="/signup">Get Started</Link>;

 return <><button type="button" disabled={busy} className={`${styles.planButton} ${plan.popular?styles.featuredButton:''}`} onClick={pay}>{busy?'Connecting…':`Choose ${plan.name}`}</button>{error&&<p role="alert">{error}</p>}</>;

}
