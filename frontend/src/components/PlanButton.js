'use client';
import {useRef} from 'react';
import Link from '@/components/ManagedLink';
import styles from './PricingSection.module.css';
export default function PlanButton({plan}){
 const dialog=useRef(null);
 if(plan.price===0)return <Link className={styles.planButton} href="/signup">Get Started →</Link>;
 const id='plan-'+plan.name.toLowerCase().replaceAll(' ','-');
 return <><button type="button" className={`${styles.planButton} ${plan.popular?styles.featuredButton:''}`} onClick={()=>dialog.current.showModal()}>Choose {plan.name} →</button><dialog className={styles.planDialog} ref={dialog} aria-labelledby={id} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}><h2 id={id}>{plan.name} plan</h2><p className={styles.dialogPrice}>₹{plan.price}<small> / month</small></p><p>{plan.storage} cloud storage · {plan.file} maximum file size.</p><p>Coming soon. This plan is not available for purchase yet. All current tools are free to use.</p><div className={styles.dialogActions}><Link className={styles.planButton} href="/tools">Explore Free Tools</Link><button type="button" className={styles.planButton} onClick={()=>dialog.current.close()}>Close</button></div></dialog></>;
}
