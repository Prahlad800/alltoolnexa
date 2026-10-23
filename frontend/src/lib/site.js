import {publicSiteURL} from '../../shared/origins.mjs';
export const siteURL=publicSiteURL;
export function pageMetadata(title,description,path){return {title,description,alternates:{canonical:path},openGraph:{title:`${title} | AllToolNexa`,description,url:siteURL+path,type:'website',siteName:'AllToolNexa'}};}
export const jsonLD = value => JSON.stringify(value).replaceAll('<','\\u003c');
