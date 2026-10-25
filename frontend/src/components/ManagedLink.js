'use client';
import Link from 'next/link';
import {useAvailability} from './SiteRuntime';
export default function ManagedLink({href,children,className='',style,title,...props}){
 const {disabled,pending}=useAvailability(href);
 if(disabled)return <a role="link" aria-disabled="true" tabIndex={-1} className={`${className} disabled-link`} style={style} title={pending?'Checking availability':'Temporarily unavailable'} aria-label={props['aria-label']} onClick={e=>{e.preventDefault();e.stopPropagation();}}>{children}<small className="availability-badge">{pending?'Checking...':'Unavailable'}</small></a>;
 return <Link href={href} className={className} style={style} title={title} {...props}>{children}</Link>;
}
