import path from 'node:path';
export default {...(process.env.NEXT_STATIC_EXPORT==='1'?{output:'export'}:{}),reactCompiler:true,turbopack:{root:path.resolve(import.meta.dirname)}};
