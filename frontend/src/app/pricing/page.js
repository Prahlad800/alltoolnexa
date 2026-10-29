import {pageMetadata} from '@/lib/site';
import PricingSection from '@/components/PricingSection';
export const metadata=pageMetadata('Pricing - Free Tools and Storage Plans','Compare free tools and cloud storage plans from INR 39/month or INR 349/year. Save up to 25.4% with annual billing. Browser tools remain free.','/pricing');
export default function PricingPage(){return <div style={{maxWidth:1600,margin:'0 auto',padding:'32px 20px'}}><PricingSection light/></div>;}
