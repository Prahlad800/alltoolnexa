'use client';

import {usePathname} from 'next/navigation';
import Link from '@/components/ManagedLink';
import {T} from './LanguageProvider';

const destinations=[
 ['/', 'Home', 'M3 10 12 3l9 7v10h-6v-6H9v6H3z'],
 ['/tools', 'Tools', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
 ['/categories', 'Categories', 'M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z'],
 ['/translate', 'Translate', 'M3 5h12M9 3v2M5 5c0 7 8 10 8 10M13 5c0 7-8 10-8 10M14 21l4-10 4 10M16 17h4'],
 ['/account', 'Profile', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 6 0 0 1 16 0v2'],
];

export default function MobileNavigation(){
 const pathname=usePathname();
 if(pathname?.replace(/\/+$/,'')==='/code-editor')return null;
 return <nav className="mobile-navigation" aria-label="Mobile navigation">{destinations.map(([href,label,path])=>{
  const active=href==='/'?pathname==='/':pathname===href||pathname.startsWith(href+'/');
  return <Link key={href} href={href} aria-current={active?'page':undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={path}/></svg><span><T>{label}</T></span></Link>;
 })}</nav>;
}
