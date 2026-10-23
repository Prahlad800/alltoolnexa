import {tools,categories} from '../../shared/catalog.mjs';
import {siteURL} from '@/lib/site';
export default function sitemap(){return ['','/tools','/categories','/about','/contact','/privacy','/terms','/disclaimer',...categories.map(c=>`/categories/${c.id}`),...tools.map(t=>`/tools/${t.id}`)].map(path=>({url:siteURL+path,changeFrequency:'monthly',priority:path===''?1:path.startsWith('/tools/')?0.7:0.6}));}
