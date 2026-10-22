export const siteURL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export function pageMetadata(title,description,path){return {title,description,alternates:{canonical:path},openGraph:{title:`${title} | AllToolNexa`,description,url:siteURL+path,type:'website',siteName:'AllToolNexa'}};}
export const jsonLD = value => JSON.stringify(value).replaceAll('<','\\u003c');
