'use client';
import {useState} from 'react';
import Link from '@/components/ManagedLink';
export default function MobileNavigation(){
 const[open,setOpen]=useState(false);
 return <div className="mobile-navigation"><button type="button" className="button secondary" aria-expanded={open} aria-controls="mobile-menu" onClick={()=>setOpen(!open)}>{open?'Close':'Menu'}</button>{open&&<nav id="mobile-menu" aria-label="Mobile navigation" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>{[['/tools','All tools'],['/categories','Categories'],['/popular-tools','Popular tools'],['/pricing','Pricing'],['/login','Login'],['/signup','Sign up'],['/contact','Report an issue']].map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{label}</Link>)}</nav>}</div>;
}
