'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
const storageKey='alltoolnexa-recent';
export default function RecentTools({tools,categories}){
 const [ids,setIds]=useState([]);
 useEffect(()=>{function read(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');setIds(Array.isArray(saved)?[...new Set(saved.filter(id=>typeof id==='string'))].slice(0,12):[]);}catch{setIds([]);}}read();window.addEventListener('storage',read);return()=>window.removeEventListener('storage',read);},[]);
 const recent=ids.map(id=>tools.find(t=>t.id===id)).filter(Boolean).slice(0,6);
 function clear(){try{localStorage.removeItem(storageKey);}catch{}setIds([]);}
 return <section id="recent" className="recent-section" aria-label="Recently used tools"><div className="recent-heading"><h2><span aria-hidden="true">◷</span> Pick up where you left off.</h2>{recent.length>0&&<button onClick={clear}>Clear history</button>}</div>{recent.length?<div className="recent-links">{recent.map(t=><Link key={t.id} href={'/tools/'+t.id}><span className={'tool-icon icon-'+t.category}>{categories.find(c=>c.id===t.category)?.icon||'↗'}</span><span>{t.name}</span><b aria-hidden="true">↗</b></Link>)}</div>:<p>Your recently used tools will appear here. Only tool names are remembered on this device.</p>}</section>;
}
