export function configuredOrigin(value,label,{required=false}={}){
 if(!value){if(required)throw Error(`${label} must be configured before a production build.`);return '';}
 let url;try{url=new URL(value);}catch{throw Error(`${label} must be an absolute HTTP(S) origin.`);}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error(`${label} must be an HTTP(S) origin without credentials, path, query or fragment.`);
 if(required&&(url.protocol!=='https:'||/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(url.hostname)))throw Error(`${label} must be a public HTTPS origin in production.`);
 return url.origin;
}
const production=process.env.NODE_ENV==='production';
export const publicSiteURL=configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL||(!production?'http://localhost:3000':''),'NEXT_PUBLIC_SITE_URL',{required:production});
export const adminURL=configuredOrigin(process.env.NEXT_PUBLIC_ADMIN_URL||(!production?'http://localhost:3001':''),'NEXT_PUBLIC_ADMIN_URL',{required:production&&Boolean(process.env.NEXT_PUBLIC_ADMIN_URL)});
