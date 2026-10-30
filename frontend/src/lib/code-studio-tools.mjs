import {buildPreview,MAX_SOURCE} from '../../shared/code-playground.mjs';
import {MANIFEST_NAME,MAX_FILES,MAX_PROJECT_SOURCE,assertImportAccess,validateStudioProject,projectManifest,safeStudioPath} from '../../shared/code-studio-project.mjs';
import {hasStudioAccess,languageForPath,studioLanguage} from '../../shared/code-studio-languages.mjs';

// Only relative project imports and the locally bundled React runtime are available.
export function resolveStudioImport(from,specifier,paths){
 if(['react','react-dom','react-dom/client'].includes(specifier))return specifier;
 if(!specifier.startsWith('.'))throw Error(`Package "${specifier}" is not bundled. Download ZIP to use it in your own development environment.`);
 const parts=from.split('/');parts.pop();
 for(const part of specifier.split('/')){if(part==='..'){if(!parts.length)throw Error('Import points outside the project.');parts.pop();}else if(part&&part!=='.')parts.push(part);}
 const base=parts.join('/'),candidates=[base,...['.js','.jsx','.ts','.tsx','.json','.css','/index.js','/index.jsx','/index.ts','/index.tsx'].map(ext=>base+ext)];
 const path=candidates.find(path=>paths.includes(path));if(!path)throw Error(`Cannot find "${specifier}" imported by ${from}.`);return path;
}
export async function compileStudioModules(project,entry,{component=false,premium=false}={}){
 const [{transform},{parse}]=await Promise.all([import('sucrase'),import('acorn')]),paths=project.files.map(file=>file.path),modules=[],visited=new Set();
 const visit=path=>{
  if(visited.has(path))return;visited.add(path);
  const file=project.files.find(file=>file.path===path);if(!file)throw Error('Entry file not found.');
  if(!hasStudioAccess(file.language,premium))throw Error(`${studioLanguage(file.language).label} requires Premium or Premium Plus.`);
  if(path.endsWith('.css')){modules.push(`${JSON.stringify(path)}:function(module){module.exports={};}`);return;}
  if(path.endsWith('.json')){modules.push(`${JSON.stringify(path)}:function(module){module.exports=${JSON.stringify(JSON.parse(file.content))};}`);return;}
  if(!/\.[cm]?[jt]sx?$/i.test(path))throw Error(`Cannot execute ${path}. This file is available for editing and export.`);
  const result=transform(file.content,{transforms:['typescript','jsx','imports'],filePath:path,production:true,jsxRuntime:'classic'}).code;
  const imports=Object.create(null),specifiers=new Set();
  const walk=node=>{
   if(!node||typeof node!=='object')return;
   if(node.type==='ImportExpression')throw Error('Dynamic imports need a project bundler. Use a static relative import in this preview.');
   if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='require'){
    if(node.arguments[0]?.type!=='Literal'||typeof node.arguments[0].value!=='string')throw Error('Use a static import with a literal project path.');
    specifiers.add(node.arguments[0].value);
   }
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  };
  walk(parse(result,{ecmaVersion:'latest',sourceType:'script'}));
  for(const specifier of specifiers){
   const dependency=resolveStudioImport(path,specifier,paths);imports[specifier]=dependency;
   if(!['react','react-dom','react-dom/client'].includes(dependency))visit(dependency);
  }
  modules.push(`${JSON.stringify(path)}:function(module,exports,require){\n${result}\n}`);
  modules.push(`${JSON.stringify(path+'#imports')}:${JSON.stringify(imports)}`);
 };
 visit(entry);
 return `(function(){\nconst React=globalThis.__studioReact?.React,modules={${modules.join(',\n')}},cache=Object.create(null);\nfunction load(path){\n if(path==='react')return globalThis.__studioReact?.React;\n if(path==='react-dom'||path==='react-dom/client')return globalThis.__studioReact?.ReactDOM;\n if(cache[path])return cache[path].exports;\n if(!Object.prototype.hasOwnProperty.call(modules,path)||typeof modules[path]!=='function')throw Error('Module unavailable: '+path);\n const module={exports:{}};cache[path]=module;\n modules[path](module,module.exports,name=>{const mapped=modules[path+'#imports']?.[name];if(!mapped)throw Error('Import unavailable: '+name);return load(mapped);});return module.exports;\n}\nconst entry=load(${JSON.stringify(entry)});\n${component?`const App=entry.default;if(typeof App!=='function'&&typeof App!=='object')throw Error('Export a default React component to preview this file.');globalThis.__studioReact.ReactDOM.createRoot(document.getElementById('root')).render(globalThis.__studioReact.React.createElement(App));`:''}\n})();`;
}
export async function studioPreview(project,file,runId,{premium=false}={}){
 let html=file.content,css=project.files.filter(file=>file.language==='css').map(file=>file.content).join('\n'),js='';
 if(['jsx','tsx','react','react-ts'].includes(file.language)){
  const response=await fetch('/vendor/code-preview-react.js');if(!response.ok)throw Error('React preview could not load. Reload and try again.');
  html='<div id="root"></div>';css+='\nbody{margin:0;padding:32px;font:15px/1.6 system-ui;background:#f6f3ff;color:#201a36}button{padding:12px 18px;background:#7047eb;color:white;border:0;border-radius:8px;cursor:pointer}';
  js=await response.text()+'\n'+await compileStudioModules(project,file.path,{component:true,premium});
 }else if(file.language==='markdown'){
  const [{marked},{default:DOMPurify}]=await Promise.all([import('marked'),import('dompurify')]);
  html=DOMPurify.sanitize(marked.parse(file.content,{async:false}));css='body{margin:0;padding:28px;font:15px/1.7 system-ui;color:#25304b}pre{overflow:auto;background:#f3f2fa;padding:16px;border-radius:8px}code{font-family:monospace}img{max-width:100%}';
 }else if(file.language==='svg'){
  const {default:DOMPurify}=await import('dompurify');html=DOMPurify.sanitize(file.content,{USE_PROFILES:{svg:true,svgFilters:true}});css='body{margin:0;display:grid;min-height:100vh;place-items:center;background:#faf9ff}svg{max-width:100%;height:auto}';
 }else{
  const htmlFile=project.target==='web'?project.files.find(item=>item.language==='html'):file.language==='html'?file:project.files.find(item=>item.language==='html');
  html=htmlFile?.content||'<main><h1>CSS preview</h1><p>Edit your stylesheet and press Run.</p><button>Sample button</button></main>';
  const doc=new DOMParser().parseFromString(html,'text/html');
  css+='\n'+Array.from(doc.head.querySelectorAll('style'),style=>style.textContent).join('\n');
  const relative=(path,source)=>resolveStudioImport(path,source.startsWith('.')?source:'./'+source,project.files.map(file=>file.path));
  const scripts=[];
  for(const script of doc.querySelectorAll('script')){
   const type=(script.getAttribute('type')||'').trim().toLowerCase();
   if(type&&!['module','text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type))continue;
   if(script.src){const source=script.getAttribute('src');if(/^(?:https?:|\/\/|data:)/.test(source))throw Error('External scripts are unavailable in this local preview. Import source files into the project.');scripts.push({path:relative(htmlFile?.path||'index.html',source)});}
   else if(script.textContent.trim())scripts.push({inline:script.textContent});
   script.remove();
  }
  for(const link of doc.querySelectorAll('link[rel="stylesheet"]'))link.remove();
  html=Array.from(doc.head.querySelectorAll('script'),script=>script.outerHTML).join('\n')+doc.body.innerHTML;
  if(scripts.length){for(const script of scripts)js+=script.path?await compileStudioModules(project,script.path,{premium})+'\n':script.inline+'\n';}
  else{const script=project.files.find(item=>item.path==='src/script.js');if(script)js=await compileStudioModules(project,script.path,{premium});}
 }
 return buildPreview({html,css,webjs:js},runId);
}
export async function formatStudioSource(file){
 const parser=({html:'html',css:'css',scss:'scss',less:'less',javascript:'babel',jsx:'babel',react:'babel',typescript:'typescript',tsx:'typescript','react-ts':'typescript',next:'typescript',angular:'typescript',json:'json',jsonc:'jsonc',notebook:'json',markdown:'markdown',mdx:'mdx',graphql:'graphql'}[file.language]);
 if(!parser)throw Error('Formatting is not available for this language. Your source is unchanged.');
 const [{format},...plugins]=await Promise.all([import('prettier/standalone'),import('prettier/plugins/html'),import('prettier/plugins/postcss'),import('prettier/plugins/babel'),import('prettier/plugins/typescript'),import('prettier/plugins/estree'),import('prettier/plugins/markdown'),import('prettier/plugins/graphql')]);
 const result=await format(file.content,{parser,plugins,tabWidth:2,singleQuote:true});
 if(result.length>MAX_SOURCE)throw Error('Formatted file exceeds the source limit.');return result;
}
async function zipText(entry,limit){
 if(entry._data?.uncompressedSize>limit*4)throw Error('An imported file is too large.');
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[],stream=entry.internalStream('uint8array');
  stream.on('data',chunk=>{size+=chunk.length;if(size>limit*4){stream.pause();reject(Error('An imported file is too large.'));return;}chunks.push(chunk);});
  stream.on('error',reject);stream.on('end',()=>{try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);text.length>limit?reject(Error('An imported file is too large.')):resolve(text);}catch{reject(Error('Import UTF-8 text source files.'));}});stream.resume();
 });
}
export async function importStudioFiles(inputFiles,premium){
 const list=Array.from(inputFiles);if(!list.length)throw Error('Choose files to import.');
 if(list.some(file=>file.size>4_000_000))throw Error('Import files up to 4 MB.');
 let files=[],folders=[],manifest;
 if(list.length===1&&/\.zip$/i.test(list[0].name)){
  const {default:JSZip}=await import('jszip'),zip=await JSZip.loadAsync(await list[0].arrayBuffer(),{createFolders:false});
  const entries=Object.values(zip.files);if(entries.length>MAX_FILES+51)throw Error('Project archives support up to 50 files and 50 folders.');
  let total=0;
  for(const entry of entries){
   // JSZip sanitizes traversal; reject the original name too.
   if(entry.unsafeOriginalName&&entry.unsafeOriginalName!==entry.name)throw Error('Unsafe archive path.');
   if(entry.dir){folders.push(safeStudioPath(entry.name.replace(/\/$/,'')));continue;}
   if(entry.name===MANIFEST_NAME){manifest=JSON.parse(await zipText(entry,20000));continue;}
   const path=safeStudioPath(entry.name),language=languageForPath(path).id,content=await zipText(entry,MAX_SOURCE);
   total+=content.length;if(total>MAX_PROJECT_SOURCE)throw Error('Project exceeds the source limit.');files.push({path,language,content});
  }
 }else{
  if(list.length>MAX_FILES)throw Error('Import up to 50 files.');
  for(const file of list){const path=safeStudioPath(file.webkitRelativePath||file.name),content=await file.text();files.push({path,language:languageForPath(path).id,content});}
 }
 if(!files.length)throw Error('No supported source files were found.');
 if(manifest){
  if(manifest.version!==2||!Array.isArray(manifest.files))throw Error('Invalid project settings.');
  files=files.map(file=>({...file,language:manifest.files.find(item=>item.path===file.path)?.language||file.language}));
 }
 const first=files.find(file=>file.language==='html')||files[0],project=validateStudioProject({version:2,name:manifest?.name||'Imported Project',target:manifest?.target||(first.language==='html'?'web':first.language),active:manifest?.active||first.path,open:manifest?.open||[first.path],stdin:manifest?.stdin||'',folders:manifest?.folders||folders,files});
 return assertImportAccess(project,premium);
}
export async function studioZip(project){
 const {default:JSZip}=await import('jszip'),zip=new JSZip();
 for(const folder of project.folders)zip.folder(folder);
 for(const file of project.files)zip.file(file.path,file.content);
 zip.file(MANIFEST_NAME,JSON.stringify(projectManifest(project),null,2));
 return zip.generateAsync({type:'blob'});
}
