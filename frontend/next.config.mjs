import path from 'node:path';
const staticExport=process.env.NEXT_STATIC_EXPORT==='1';
const nextConfig={...(staticExport?{output:'export',images:{unoptimized:true}}:{}),reactCompiler:true,turbopack:{root:path.resolve(import.meta.dirname)},...(staticExport?{}:{async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}];}})};
export default nextConfig;
