import {pageMetadata} from '@/lib/site';
import PricingSection from '@/components/PricingSection';
export const metadata=pageMetadata('Pricing - Free Tools and Storage Plans','Compare AllToolNexa plans from INR 0 to INR 199 per month. Current browser tools remain free; optional cloud storage plans are coming soon.','/pricing');
export default function PricingPage(){return <div style={{maxWidth:1600,margin:'0 auto',padding:'32px 20px'}}><PricingSection light/></div>;}
