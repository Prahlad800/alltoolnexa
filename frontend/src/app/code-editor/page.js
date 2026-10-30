import CodePlayground from '@/components/CodePlayground';
import {T} from '@/components/LanguageProvider';
import {pageMetadata} from '@/lib/site';
export const metadata=pageMetadata('Code Studio — Online Editor for Web, Python, C++ & More','A desktop and mobile code workspace with a file explorer, tabs, local preview, browser runners and ZIP projects. 13 free languages and formats; extended presets with Premium.','/code-editor');
export default function CodeEditorPage(){return <div className="container page-space" style={{maxWidth:1700}}><p className="eyebrow"><T>YOUR NEXT GREAT IDEA</T></p><h1 className="page-title"><T>A little code. Endless possibilities.</T></h1><p className="page-subtitle"><T>Your files, your editor, your creative space. Build from your browser, on any screen.</T></p><CodePlayground/></div>;}
