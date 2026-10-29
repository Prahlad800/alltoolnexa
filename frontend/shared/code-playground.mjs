export const MAX_SOURCE=100000,MAX_STDIN=16000,MAX_OUTPUT=100000;
export const LANGUAGES=[
 {id:'web',label:'HTML / CSS / JS',extension:'html',runtime:null},
 {id:'javascript',label:'JavaScript',extension:'js',runtime:'quickjs'},
 {id:'c',label:'C',extension:'c',runtime:'clang'},
 {id:'cpp',label:'C++',extension:'cpp',runtime:'clangpp'},
 {id:'python',label:'Python',extension:'py',runtime:'python'},
];
export const DEFAULT_FILES={
 html:'<main>\n  <span class="badge">AllToolNexa Code Studio</span>\n  <h1>Make something great.</h1>\n  <p>Edit HTML, CSS and JavaScript, then press Run.</p>\n  <button id="hello">Say hello</button>\n</main>',
 css:'body { margin: 0; padding: 32px; font: 16px/1.6 system-ui; background: #f5f3ff; color: #211a40; }\nmain { max-width: 600px; margin: auto; }\nh1 { font-size: 40px; line-height: 1.1; }\n.badge { color: #7047eb; font-weight: 700; font-size: 12px; }\nbutton { background: #7047eb; color: white; border: 0; padding: 12px 20px; border-radius: 10px; cursor: pointer; }',
 webjs:'document.querySelector("#hello").addEventListener("click", () => {\n  document.querySelector("h1").textContent = "Hello, AllToolNexa!";\n  console.log("Your JavaScript is running.");\n});',
 javascript:'console.log("Hello, AllToolNexa!");\nconst numbers = [1, 2, 3, 4, 5];\nconsole.log("Sum:", numbers.reduce((sum, n) => sum + n, 0));',
 c:'#include <stdio.h>\n\nint main(void) {\n    printf("Hello, AllToolNexa!\\n");\n    for (int i = 1; i <= 5; i++) {\n        printf("%d ", i);\n    }\n    printf("\\n");\n    return 0;\n}\n',
 cpp:'#include <iostream>\n#include <vector>\n#include <numeric>\n\nint main() {\n    std::vector<int> numbers = {1, 2, 3, 4, 5};\n    std::cout << "Hello, AllToolNexa!" << std::endl;\n    std::cout << "Sum: " << std::accumulate(numbers.begin(), numbers.end(), 0) << std::endl;\n    return 0;\n}\n',
 python:'print("Hello, AllToolNexa!")\nnumbers = [1, 2, 3, 4, 5]\nprint("Sum:", sum(numbers))\n',
};
export const freshProject=()=>({version:1,language:'web',webTab:'html',files:{...DEFAULT_FILES},stdin:''});
export function restoreProject(text){
 const value=JSON.parse(text);
 if(!value||value.version!==1||!LANGUAGES.some(l=>l.id===value.language)||!['html','css','webjs'].includes(value.webTab)||typeof value.stdin!=='string'||value.stdin.length>MAX_STDIN)throw Error('Invalid saved project');
 if(!value.files||Object.keys(DEFAULT_FILES).some(key=>typeof value.files[key]!=='string'||value.files[key].length>MAX_SOURCE))throw Error('Invalid saved source');
 return {version:1,language:value.language,webTab:value.webTab,stdin:value.stdin,files:Object.fromEntries(Object.keys(DEFAULT_FILES).map(key=>[key,value.files[key]]))};
}
export function sourceFile(project){return project.language==='web'?project.webTab:project.language;}
export function fileName(key){return {html:'index.html',css:'style.css',webjs:'script.js',javascript:'main.js',c:'main.c',cpp:'main.cpp',python:'main.py'}[key];}
export function buildPreview(files,runId){
 // Insert user JS as script text, never as HTML. Closing-script payloads stay inert.
 const payload=JSON.stringify({html:files.html,css:files.css,js:files.webjs,runId}).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"></head><body><script>
const data=${payload};
const send=(kind,text)=>parent.postMessage({source:'alltoolnexa-preview',runId:data.runId,kind,text:String(text).slice(0,10000)},'*');
let count=0;
for(const kind of ['log','warn','error'])console[kind]=(...args)=>{if(count++<1000)send(kind,args.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch{return String(x)}}).join(' '))};
window.addEventListener('error',e=>send('error',e.message));
window.addEventListener('unhandledrejection',e=>send('error',e.reason?.message||e.reason));
const style=document.createElement('style');style.textContent=data.css;document.head.append(style);
const content=document.createElement('div');content.innerHTML=data.html;document.body.append(content);
const script=document.createElement('script');script.textContent=data.js;document.body.append(script);
send('ready','Preview ready');
</script></body></html>`;
}

// Parse the regular files used by the pinned upstream filesystem archives.
export function readTar(bytes){
 const decode=new TextDecoder(),files={},stamp=new Date(0);let offset=0;
 const field=(start,length)=>decode.decode(bytes.subarray(start,start+length)).split('\0')[0];
 while(offset+512<=bytes.length){
  const name=field(offset,100);if(!name)break;
  const prefix=field(offset+345,155),raw=(prefix?prefix+'/':'')+name;
  const size=parseInt(field(offset+124,12).trim()||'0',8),type=field(offset+156,1);
  if(!Number.isSafeInteger(size)||size<0||offset+512+size>bytes.length)throw Error('Invalid runtime archive');
  const path='/'+raw.replace(/^\.\//,'').replace(/^\/+/, '');
  if(path.split('/').includes('..'))throw Error('Invalid runtime path');
  if(type===''||type==='0')files[path]={path,mode:'binary',content:bytes.slice(offset+512,offset+512+size),timestamps:{access:stamp,modification:stamp,change:stamp}};
  else if(type!=='5')throw Error('Unsupported runtime archive entry: '+type);
  offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
