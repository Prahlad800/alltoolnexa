import Link from 'next/link';
import {notFound} from 'next/navigation';
import {tools,categories} from '../../../../shared/catalog.mjs';
import ToolCard from '@/components/ToolCard';
import {pageMetadata} from '@/lib/site';
export function generateStaticParams(){return categories.map(c=>({slug:c.id}));}
export async function generateMetadata({params}){const{slug}=await params,c=categories.find(c=>c.id===slug);return c?pageMetadata(`${c.name} tools`,c.description,`/categories/${c.id}`):{};}
export default async function Category({params}){const{slug}=await params,c=categories.find(c=>c.id===slug);if(!c)notFound();const group=tools.filter(t=>t.category===c.id);return <div className="container page-space"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/categories">Categories</Link><span>/</span><span>{c.name}</span></nav><p className="eyebrow">{group.length} FREE TOOLS</p><h1 className="page-title">{c.name} tools.</h1><p className="page-subtitle">{c.description} Free to use, without registration.</p><div className="tool-grid">{group.map(t=><ToolCard key={t.id} tool={t} category={c}/>)}</div></div>;}
