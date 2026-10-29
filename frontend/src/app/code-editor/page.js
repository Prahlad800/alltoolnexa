import CodePlayground from '@/components/CodePlayground';
import {T} from '@/components/LanguageProvider';
import {pageMetadata} from '@/lib/site';
export const metadata=pageMetadata('Free Online Code Editor — HTML, CSS, JavaScript, C, C++ & Python','Write and run HTML, CSS, JavaScript, C, C++ and Python in your browser. Free code editor with syntax highlighting, website preview, standard input and source download. Works on mobile.','/code-editor');
export default function CodeEditorPage(){return <div className="container page-space" style={{maxWidth:1500}}><p className="eyebrow"><T>BUILD SOMETHING NEW</T></p><h1 className="page-title"><T>Your ideas. Your code.</T></h1><p className="page-subtitle"><T>A free workspace for HTML, CSS, JavaScript, C, C++ and Python. Write, run and keep creating.</T></p><CodePlayground/></div>;}
