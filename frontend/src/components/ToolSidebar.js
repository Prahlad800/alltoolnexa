'use client';
import ToolIcon from './ToolIcon';
import {useState} from 'react';
import Link from '@/components/ManagedLink';
import {categories,tools} from '../../shared/catalog.mjs';
export default function ToolSidebar({activeCategory}){
 const [query,setQuery]=useState('');
 const matches=query.trim()?tools.filter(t=>(t.name+' '+t.id).toLowerCase().includes(query.trim().toLowerCase())).slice(0,12):[];
 return <aside className="toolbox-sidebar"><h2>YOUR TOOLBOX</h2><label className="toolbox-search"><span className="sr-only">Search toolbox</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tools…" aria-label="Search toolbox"/></label>{query.trim()?<nav aria-label="Tool search results">{matches.map(t=><Link prefetch={false} key={t.id} href={`/tools/${t.id}`}><ToolIcon tool={t} compact/>{t.name}</Link>)}{!matches.length&&<p className="hint">No matching tools.</p>}<Link prefetch={false} href={`/tools?q=${encodeURIComponent(query)}`} className="toolbox-search-all">See all search results →</Link></nav>:<nav aria-label="Toolbox categories">{categories.map(c=><Link prefetch={false} key={c.id} href={`/categories/${c.id}`} aria-current={activeCategory===c.id?'true':undefined}><ToolIcon category={c.id} compact/>{c.name}</Link>)}<Link prefetch={false} href="/draftword">DraftWord</Link><Link prefetch={false} href="/draftsheet">DraftSheet</Link></nav>}</aside>;
}
