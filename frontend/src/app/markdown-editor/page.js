import MarkdownStudio from '@/components/MarkdownStudio';
import {T} from '@/components/LanguageProvider';
import {pageMetadata} from '@/lib/site';
export const metadata=pageMetadata('Markdown Editor, Viewer & Converter — MD to Word, PDF, HTML & More','Edit and preview Markdown, open MD/TXT/HTML/DOCX, and convert MD to Word, PDF, HTML, TXT or RTF. Free, private, mobile-friendly and entirely in your browser.','/markdown-editor');
export default function MarkdownEditorPage(){return <div className="container page-space" style={{maxWidth:1500}}><p className="eyebrow"><T>YOUR MARKDOWN WORKSPACE</T></p><h1 className="page-title"><T>Write once. Share anywhere.</T></h1><p className="page-subtitle"><T>Edit, preview and convert Markdown to Word, PDF, HTML, TXT and RTF. Free, without signing up.</T></p><MarkdownStudio/></div>;}
