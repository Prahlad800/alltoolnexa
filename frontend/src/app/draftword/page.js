import {pageMetadata} from '@/lib/site';
import DraftWord from '@/components/PKWord';
export const metadata=pageMetadata('DraftWord - Free Online Document Editor','Create and format documents with headings, tables and images. Save drafts on your device, import DOCX or text and download DOCX.','/draftword');
export default function Page(){return <DraftWord/>;}
