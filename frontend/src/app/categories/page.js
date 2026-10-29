import {T} from '@/components/LanguageProvider';
import Link from '@/components/ManagedLink';
import ToolIcon from '@/components/ToolIcon';
import {tools,categories,mainCategories} from '../../../shared/catalog.mjs';
import {pageMetadata} from '@/lib/site';
export const metadata=pageMetadata('Tool categories','507 tools in five main categories and eighteen subcategories.','/categories');
export default function Categories(){return <div className="container page-space"><p className="eyebrow">5 MAIN CATEGORIES / 18 SUBCATEGORIES / {tools.length} TOOLS</p><h1 className="page-title">Explore the toolkit.</h1><p className="page-subtitle">Choose a main category, then a subcategory to find your tool.</p><div className="taxonomy-grid">{mainCategories.map(g=><section className="taxonomy-group" key={g.id}><Link className="taxonomy-heading" href={`/categories/${g.id}`}><ToolIcon category={g.icon}/><div><h2><T>{g.name}</T></h2><small>{g.children.length} subcategories / {tools.filter(t=>g.children.includes(t.category)).length} tools</small></div><span aria-hidden="true">&rarr;</span></Link><div className="taxonomy-children">{g.children.map(id=>categories.find(c=>c.id===id)).map(c=><Link key={c.id} href={`/categories/${c.id}`}><ToolIcon category={c.id} compact/><span><T>{c.name}</T></span><small>{tools.filter(t=>t.category===c.id).length}</small></Link>)}</div></section>)}</div></div>;}
