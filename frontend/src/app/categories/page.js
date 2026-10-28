import ToolIcon from '@/components/ToolIcon';
import Link from '@/components/ManagedLink';
import {tools,categories} from '../../../shared/catalog.mjs';
import {pageMetadata,collectionSchema,jsonLD} from '@/lib/site';
export const metadata=pageMetadata('Tool categories','Find tools organized by task: math, writing, developer, image, PDF, finance and more.','/categories');
export default function Categories(){return <div className="container page-space"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLD(collectionSchema('Tool categories','/categories',categories.map(c=>({name:c.name,path:`/categories/${c.id}`}))))}}/><p className="eyebrow">A PLACE FOR EVERY TASK</p><h1 className="page-title">Explore the toolkit.</h1><p className="page-subtitle">Pick a category. Find a simpler way to get it done.</p><div className="category-grid">{categories.map(c=><Link className="category-card" href={`/categories/${c.id}`} key={c.id}><ToolIcon category={c.id}/><div><h2>{c.name} <span>↗</span></h2><p>{c.description}</p><small>{tools.filter(t=>t.category===c.id).length} free tools</small></div></Link>)}</div></div>;}
