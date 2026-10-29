import {T} from '@/components/LanguageProvider';
import {notFound} from 'next/navigation';
import Link from '@/components/ManagedLink';
import ToolCard from '@/components/ToolCard';
import ToolIcon from '@/components/ToolIcon';
import {tools,categories,mainCategories} from '../../../../shared/catalog.mjs';
import {pageMetadata} from '@/lib/site';
export function generateStaticParams(){return [...mainCategories,...categories].map(c=>({slug:c.id}));}
export async function generateMetadata({params}){const {slug}=await params,c=[...mainCategories,...categories].find(c=>c.id===slug);return c?pageMetadata(c.name,c.description||`Explore ${c.name} and its subcategories.`,`/categories/${c.id}`):{};}
export default async function Category({params}){const {slug}=await params,c=[...mainCategories,...categories].find(c=>c.id===slug);if(!c)notFound();const parent=mainCategories.find(g=>g.id===c.parentId),group=tools.filter(t=>c.children?c.children.includes(t.category):t.category===c.id);return <div className="container page-space"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/categories">Categories</Link><span>/</span>{parent&&<><Link href={`/categories/${parent.id}`}>{parent.name}</Link><span>/</span></>}<span><T>{c.name}</T></span></nav><p className="eyebrow">{group.length} FREE TOOLS{c.children&&` / ${c.children.length} SUBCATEGORIES`}</p><h1 className="page-title"><T>{c.name}</T></h1><p className="page-subtitle">{c.description||'Choose a subcategory or browse all tools below.'}</p>{c.children&&<div className="category-grid taxonomy-subcategories">{c.children.map(id=>categories.find(s=>s.id===id)).map(s=><Link className="category-card" href={`/categories/${s.id}`} key={s.id}><ToolIcon category={s.id}/><div><h2><T>{s.name}</T></h2><small>{tools.filter(t=>t.category===s.id).length} tools</small></div></Link>)}</div>}<div className="tool-grid">{group.map(t=><ToolCard key={t.id} tool={t} category={categories.find(s=>s.id===t.category)}/>)}</div></div>;}
