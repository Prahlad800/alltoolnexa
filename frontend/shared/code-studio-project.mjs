import {DEFAULT_FILES,MAX_SOURCE,MAX_STDIN,restoreProject} from './code-playground.mjs';
import {studioLanguage,languageForPath,starterSource,defaultPath,hasStudioAccess} from './code-studio-languages.mjs';

export const STUDIO_STORAGE_KEY='alltoolnexa-code-studio-v2';
export const LEGACY_STORAGE_KEY='alltoolnexa-code-studio-v1';
export const MAX_PROJECT_SOURCE=1_000_000,MAX_FILES=50,MAX_FOLDERS=50;
export const MANIFEST_NAME='alltoolnexa.studio.json';
const webPaths={html:'index.html',css:'src/style.css',webjs:'src/script.js'};
export const WEB_HTML=`<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My Project</title>\n  <link rel="stylesheet" href="src/style.css">\n</head>\n<body>\n<main class="welcome">\n  <span class="badge">YOUR NEXT GREAT IDEA</span>\n  <h1>Welcome to<br><span>AllToolNexa</span><br>Code Studio.</h1>\n  <p>A little code. A world of possibilities.</p>\n  <button id="hello">Start creating <span>→</span></button>\n  <div class="code-card"><i></i><i></i><i></i><pre><b>const</b> idea = <em>'something great'</em>;\n<b>function</b> start() {\n  <b>return</b> imagination + code;\n}</pre></div>\n</main>\n<script src="src/script.js"></script>\n</body>\n</html>`;
export const WEB_CSS=`* { box-sizing: border-box; }\nbody { margin: 0; padding: 38px 26px; font: 15px/1.6 system-ui, sans-serif; background: radial-gradient(ellipse at 90% 55%, #44218590, transparent 65%), #090f25; color: #f6f5ff; min-height: 100vh; }\n.welcome { max-width: 600px; margin: auto; }\n.badge { color: #b49dff; letter-spacing: 2px; font-size: 10px; font-weight: 700; }\nh1 { font-size: clamp(32px, 6vw, 54px); line-height: 1.12; letter-spacing: -2px; margin: 22px 0; }\nh1 span { color: #b99aff; }\np { color: #b4b4cc; }\nbutton { background: linear-gradient(120deg, #8557fa, #6536de); color: white; border: 1px solid #a887ff; padding: 13px 22px; border-radius: 9px; font-weight: 600; cursor: pointer; margin: 8px 0 24px; }\nbutton span { margin-left: 12px; }\n.code-card { background: #121b30; border: 1px solid #34314f; border-radius: 14px; padding: 18px; box-shadow: 0 16px 60px #7452df20; }\n.code-card i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #66517f; margin-right: 5px; }\n.code-card i:first-child { background: #d46c9a; }\n.code-card i:nth-child(2) { background: #d8ac6a; }\npre { color: #b7c7e2; font: 12px/1.9 monospace; overflow: auto; }\npre b { color: #b391ed; }\npre em { color: #9bc6a1; font-style: normal; }\n`;
export const WEB_JS=`document.querySelector('#hello').addEventListener('click', () => {\n  document.querySelector('h1').textContent = 'You made it happen.';\n  console.log('Your JavaScript is running. Keep creating!');\n});\n`;

export function safeStudioPath(path){
 if(typeof path!=='string'||path.length>140||!path||path.startsWith('/')||path.includes('\\')||!path.split('/').every(part=>part&&part!=='.'&&part!=='..'&&part!=='.git'&&/^[\w .@()-]+$/.test(part)&&part.trim()===part))throw Error('Use a relative file path, for example src/App.tsx.');
 if(path===MANIFEST_NAME)throw Error('This filename is reserved for project settings.');
 return path;
}
export function freshStudioProject(){
 return {version:2,name:'My Project',target:'web',active:'index.html',open:['index.html','src/style.css','src/script.js'],folders:['src'],stdin:'',files:[
  {path:'index.html',language:'html',content:WEB_HTML},
  {path:'src/style.css',language:'css',content:WEB_CSS},
  {path:'src/script.js',language:'javascript',content:WEB_JS},
  {path:'README.md',language:'markdown',content:'# My Project\n\nMade with AllToolNexa Code Studio.\n\nOpen index.html, edit your code, and press Run. Download ZIP to keep your project.\n'},
 ]};
}
export function validateStudioProject(value){
 if(!value||value.version!==2||typeof value.name!=='string'||!value.name.trim()||value.name.length>60||!studioLanguage(value.target)||typeof value.stdin!=='string'||value.stdin.length>MAX_STDIN||!Array.isArray(value.files)||!value.files.length||value.files.length>MAX_FILES||!Array.isArray(value.open)||!Array.isArray(value.folders)||value.folders.length>MAX_FOLDERS)throw Error('Invalid Code Studio project.');
 const paths=new Set();let size=0;
 const files=value.files.map(file=>{
  const path=safeStudioPath(file.path),language=studioLanguage(file.language);
  if(paths.has(path)||!language||file.language==='web'||!language.extensions.includes(path.split('.').pop().toLowerCase())||typeof file.content!=='string'||file.content.length>MAX_SOURCE)throw Error('Invalid source file or language.');
  paths.add(path);size+=file.content.length;return {path,language:file.language,content:file.content};
 });
 if(size>MAX_PROJECT_SOURCE)throw Error('Projects are limited to 1,000,000 source characters.');
 if(!paths.has(value.active)||value.open.some(path=>!paths.has(path)))throw Error('The active file is missing.');
 const folders=[...new Set(value.folders.map(safeStudioPath))];
 if(folders.some(folder=>folder.split('/').some((_,i,parts)=>paths.has(parts.slice(0,i+1).join('/'))))||files.some(file=>file.path.split('/').slice(0,-1).some((_,i,parts)=>paths.has(parts.slice(0,i+1).join('/')))))throw Error('A file and folder cannot share a path.');
 return {version:2,name:value.name.trim(),target:value.target,active:value.active,open:[...new Set([...value.open,value.active])],folders,stdin:value.stdin,files};
}
export function restoreStudioProject(text){
 const value=JSON.parse(text);
 if(value?.version!==1)return validateStudioProject(value);
 const legacy=restoreProject(text),files=Object.entries(legacy.files).map(([key,content])=>({path:webPaths[key]||`main.${{javascript:'js',c:'c',cpp:'cpp',python:'py'}[key]}`,language:{html:'html',css:'css',webjs:'javascript'}[key]||key,content}));
 const active=legacy.language==='web'?webPaths[legacy.webTab]:files.find(file=>file.language===legacy.language&&file.path.startsWith('main.')).path;
 return validateStudioProject({version:2,name:'My Project',target:legacy.language,active,open:files.map(file=>file.path),files,folders:['src'],stdin:legacy.stdin});
}
export function uniqueStudioPath(project,path){
 safeStudioPath(path);let candidate=path,index=2;
 const dot=path.lastIndexOf('.'),base=path.slice(0,dot),extension=path.slice(dot);
 while(project.files.some(file=>file.path===candidate)||project.folders.includes(candidate))candidate=`${base}-${index++}${extension}`;
 return candidate;
}
export function newStudioFile(project,path,language,content=''){
 safeStudioPath(path);
 if(!studioLanguage(language))throw Error('Choose a supported language.');
 if(project.files.some(file=>file.path===path)||project.folders.includes(path))throw Error('That path already exists.');
 return validateStudioProject({...project,active:path,open:[...project.open,path],target:language,files:[...project.files,{path,language,content}]});
}
export function openStudioLanguage(project,id){
 const language=studioLanguage(id);if(!language)throw Error('Choose a supported language.');
 if(id==='web'){
  const html=project.files.find(file=>file.language==='html');
  if(html)return {...project,target:'web',active:html.path,open:[...new Set([...project.open,html.path])]};
  const next=newStudioFile(project,'index.html','html',WEB_HTML);
  for(const [path,language,content] of [['src/style.css','css',WEB_CSS],['src/script.js','javascript',WEB_JS]])if(!next.files.some(file=>file.path===path))next.files.push({path,language,content});
  return validateStudioProject({...next,target:'web'});
 }
 const existing=id==='javascript'?project.files.find(file=>file.language===id&&!Object.values(webPaths).includes(file.path)):project.files.find(file=>file.language===id);
 if(existing)return {...project,target:id,active:existing.path,open:[...new Set([...project.open,existing.path])]};
 const content=DEFAULT_FILES[id]??starterSource(id),path=uniqueStudioPath(project,defaultPath(id));
 return newStudioFile(project,path,id,content);
}
export function openStudioFile(project,path){
 const file=project.files.find(file=>file.path===path);if(!file)throw Error('File not found.');
 const target=Object.values(webPaths).includes(path)&&project.files.some(file=>file.path==='index.html')?'web':file.language;
 return {...project,active:path,target,open:[...new Set([...project.open,path])]};
}
export function renameStudioFile(project,oldPath,newPath){
 safeStudioPath(newPath);if(newPath===oldPath)return project;
 if(project.files.some(file=>file.path===newPath)||project.folders.includes(newPath))throw Error('That path already exists.');
 const current=project.files.find(file=>file.path===oldPath),language=studioLanguage(current.language);
 // Preserve explicitly selected SQL dialects/frameworks while the extension matches.
 const id=language.extensions.includes(newPath.split('.').pop().toLowerCase())?current.language:languageForPath(newPath).id;
 return validateStudioProject({...project,active:project.active===oldPath?newPath:project.active,open:project.open.map(path=>path===oldPath?newPath:path),target:project.active===oldPath?id:project.target,files:project.files.map(file=>file.path===oldPath?{...file,path:newPath,language:id}:file)});
}
export function removeStudioFile(project,path){
 if(project.files.length===1)throw Error('Keep at least one file in your project.');
 const files=project.files.filter(file=>file.path!==path),open=project.open.filter(item=>item!==path);
 const next={...project,files,open};return project.active===path?openStudioFile(next,open.at(-1)||files[0].path):next;
}
export function projectManifest(project){
 return {...project,files:project.files.map(({path,language})=>({path,language}))};
}
export function assertImportAccess(project,premium){
 const locked=project.files.find(file=>!hasStudioAccess(file.language,premium));
 if(locked)throw Error(`${studioLanguage(locked.language).label} requires Premium or Premium Plus. Your current project has not changed.`);
 return project;
}
export function projectTree(project,query=''){
 const root={name:'',path:'',folders:new Map(),files:[]};
 const ensure=path=>{let current=root,parts=[];for(const part of path.split('/').filter(Boolean)){parts.push(part);if(!current.folders.has(part))current.folders.set(part,{name:part,path:parts.join('/'),folders:new Map(),files:[]});current=current.folders.get(part);}return current;};
 if(!query)for(const path of project.folders)ensure(path);
 for(const file of project.files.filter(file=>!query||file.path.toLowerCase().includes(query.toLowerCase())||file.content.toLowerCase().includes(query.toLowerCase()))){const parts=file.path.split('/');parts.pop();ensure(parts.join('/')).files.push(file);}
 return root;
}
