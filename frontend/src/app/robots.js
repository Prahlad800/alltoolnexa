import {siteURL} from '@/lib/site';
export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/api/']},sitemap:siteURL+'/sitemap.xml'};}
