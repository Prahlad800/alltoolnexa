'use client';

import {T} from '@/components/LanguageProvider';
import Link from '@/components/ManagedLink';
import {useEffect,useState} from 'react';
import {getSession} from '../../shared/api-client.mjs';

export function notifyUserSession(){window.dispatchEvent(new Event('alltoolnexa-auth-changed'));}
export default function UserNavigation(){
 const [session,setSession]=useState(null);
 useEffect(()=>{let active=true;const refresh=()=>getSession().then(value=>{if(active)setSession(value);}).catch(()=>{if(active)setSession(null);});const expired=()=>setSession(null);window.addEventListener('alltoolnexa-session-expired',expired);refresh();window.addEventListener('alltoolnexa-auth-changed',refresh);window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('alltoolnexa-session-expired',expired);window.removeEventListener('alltoolnexa-auth-changed',refresh);window.removeEventListener('focus',refresh);};},[]);
 return <div className="user-navigation" aria-label="User account">{session?<Link className="header-cta" href="/dashboard"><T>Dashboard</T></Link>:<><Link className="header-login" href="/login"><T>Login</T></Link><Link className="header-cta" href="/signup"><T>Sign up</T></Link></>}</div>;
}
