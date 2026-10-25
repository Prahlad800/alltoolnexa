import {siteURL} from '@/lib/site';
export default function robots(){const disallow=['/api/','/admin','/account','/login','/signup'];return {rules:[{userAgent:'*',allow:'/',disallow},{userAgent:'OAI-SearchBot',allow:'/',disallow}],sitemap:siteURL+'/sitemap.xml'};}
