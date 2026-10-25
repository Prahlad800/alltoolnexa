import PlanButton from './PlanButton';
import styles from './PricingSection.module.css';
const plans=[
 {name:'Free',price:0,storage:'50 MB',file:'2 MB',features:['All tools free','Website + app sync','With ads']},
 {name:'Basic',price:39,storage:'200 MB',file:'20 MB',features:['All tools free','Ad-free experience','Website + app sync']},
 {name:'Pro',price:89,storage:'1 GB',file:'100 MB',features:['All tools free','Ad-free experience','Saved file history']},
 {name:'Premium',price:149,storage:'5 GB',file:'500 MB',popular:true,features:['All tools free','Ad-free + sync','Priority processing','30-day file recovery']},
 {name:'Premium Plus',price:199,storage:'10 GB',file:'1 GB',plus:true,features:['All tools free','Ad-free + sync','Priority processing','30-day file recovery']},
];
export default function PricingSection({light=false}){return <section id="pricing" className={`${styles.section} ${light?styles.light:''}`} aria-labelledby="pricing-title"><div className={styles.heading}><h2 id="pricing-title">Choose your AllToolNexa plan</h2><p>All tools available to everyone. Upgrade for more cloud storage.</p></div><div className={styles.grid}>{plans.map(plan=><article key={plan.name} className={`${styles.card} ${plan.popular?styles.popular:''} ${plan.plus?styles.plus:''}`} aria-label={`${plan.name} plan`}>{plan.popular&&<span className={styles.badge}>Most popular</span>}<h3>{plan.name}</h3><p className={styles.price}>₹{plan.price}<span>/month</span></p><div className={styles.storage}><strong>{plan.storage}</strong><b>Cloud Storage</b><span>{plan.file} max file size</span></div><ul>{plan.features.map(feature=><li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul><PlanButton plan={plan}/></article>)}</div><p className={styles.note}>Cloud storage plans are coming soon. Payments, sync and cloud recovery are not yet available. All current browser tools remain free.</p></section>;}
