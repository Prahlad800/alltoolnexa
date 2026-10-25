import {pageMetadata} from '@/lib/site';
import {tools,categories} from '../../../shared/catalog.mjs';
import ToolCard from '@/components/ToolCard';
import RecentTools from '@/components/RecentTools';
import Link from '@/components/ManagedLink';
export const metadata=pageMetadata('Popular Free Online Tools','Try popular PDF tools, image compressors, text utilities, QR generators and calculators. Free browser tools with no account required.','/popular-tools');
export default function PopularTools(){const ids=['image-compressor','image-resize','pdf-merge','images-to-pdf','word-counter','json-formatter','meta-tag-generator','url-qr','percentage-calculator','emi-calculator','password-generator','age-calculator'];return <div className="container page-space"><p className="eyebrow">YOUR EVERYDAY ESSENTIALS</p><h1 className="page-title">A useful place to start.</h1><p className="page-subtitle">A handpicked selection of handy tools. Free to use, right in your browser.</p><RecentTools tools={tools.map(({id,name,category})=>({id,name,category}))} categories={categories}/><div className="tool-grid popular-page-grid">{ids.map(id=>tools.find(t=>t.id===id)).filter(Boolean).map(t=><ToolCard key={t.id} tool={t} category={categories.find(c=>c.id===t.category)}/>)}</div><Link href="/tools" className="button primary load-more">Explore all {tools.length} tools ↗</Link></div>;}
