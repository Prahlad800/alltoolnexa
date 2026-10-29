export const dynamic='force-static';
import {tools,categories,mainCategories} from '../../shared/catalog.mjs';
import {siteURL} from '@/lib/site';
export default function sitemap(){return ['','/tools','/code-editor','/markdown-editor','/translate','/categories','/about','/contact','/privacy','/terms','/disclaimer','/pricing','/popular-tools','/draftword','/draftsheet','/office',...mainCategories.map(c=>`/categories/${c.id}`),...categories.map(c=>`/categories/${c.id}`),...tools.map(t=>`/tools/${t.id}`)].map(path=>({url:siteURL+path,changeFrequency:'monthly',priority:path===''?1:path.startsWith('/tools/')?0.7:0.6}));}
