import {tools,categories} from '../../../shared/catalog.mjs';
import Directory from '@/components/Directory';
import {pageMetadata} from '@/lib/site';
export const metadata=pageMetadata('All free tools','Search our free browser-local calculators, converters, image, PDF and developer tools. No account required.','/tools');
export default async function ToolsPage({searchParams}){const params=await searchParams;return <div className="container page-space"><p className="eyebrow">ONE PLACE. EVERYDAY POSSIBILITIES.</p><h1 className="page-title">Find your next shortcut.</h1><p className="page-subtitle">{tools.length} useful tools. All free, all ready when you are.</p><Directory tools={tools} categories={categories} initialQuery={typeof params.q==='string'?params.q:''}/></div>;}
