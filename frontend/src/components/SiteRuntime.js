'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {apiRequest} from '../../shared/api-client.mjs';
import VisitorTracking from './VisitorTracking';

const Availability=createContext({state:null,catalog:[],refresh:()=>{}});
export default function SiteRuntime({initialState,catalog,children}){
 const [state,setState]=useState(initialState);
 const refresh=useCallback(()=>apiRequest('/api/public/availability').then(setState).catch(()=>{}),[]);
 useEffect(()=>{refresh();const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[refresh]);
 const value=useMemo(()=>({state,catalog,refresh}),[state,catalog,refresh]);
 return <Availability.Provider value={value}>{children}<VisitorTracking/></Availability.Provider>;
}
export function useAvailability(href){
 const {state,catalog,refresh}=useContext(Availability);
 const path=(typeof href==='string'?href:href?.pathname||'').split(/[?#]/)[0];
 let toolId=path.startsWith('/tools/')?path.split('/')[2]:['/draftsheet','/pkexcel'].includes(path)?'spreadsheet-editor':['/draftword','/pkword'].includes(path)?'draftword':null;
 const tool=catalog.find(t=>t.id===toolId);
 const category=path.startsWith('/categories/')?path.split('/')[2]:tool?.category;
 const managed=Boolean(tool||path.startsWith('/categories/'));
 const pending=managed&&!state;
 const disabled=managed&&(pending||state.disabledTools.includes(toolId)||state.disabledCategories.includes(category));
 return {disabled,pending,refresh};
}
export function ToolRouteGate({children}){
 const path=usePathname(),{disabled,pending,refresh}=useAvailability(path);
 if(!disabled)return children;
 return <section className="container page-space availability-message" role="status"><span aria-hidden="true">&#9881;</span><h1>{pending?'Checking availability...':'Temporarily unavailable'}</h1><p>{pending?'The tool service could not yet be reached. Try again in a moment.':'The administrator has deactivated this tool or category. Please choose another available tool.'}</p><button type="button" className="button primary" onClick={refresh}>Check again</button><Link className="button secondary" href="/tools">Browse tools</Link></section>;
}
