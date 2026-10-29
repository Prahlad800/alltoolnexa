import {WASI} from '@runno/wasi';
import {gunzipSync} from 'fflate';
import {RUNTIME_BASE,RUNTIME_ASSETS,assetFile} from '../../shared/code-runtime-manifest.mjs';
import {MAX_SOURCE,MAX_STDIN,MAX_OUTPUT,readTar} from '../../shared/code-playground.mjs';

async function asset(name){
 const entry=RUNTIME_ASSETS.find(item=>item.name===name);
 const response=await fetch(`${RUNTIME_BASE}/${assetFile(entry)}`);
 if(!response.ok)throw Error('Runtime download failed. Check your connection and try Run again.');
 const packed=new Uint8Array(await response.arrayBuffer());
 const data=name.endsWith('.wasm')?gunzipSync(packed):packed;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(data.length!==entry.bytes||hash!==entry.sha256)throw Error('Runtime integrity check failed. Please reload and try again.');
 return data;
}
const wasm=data=>new Response(data,{headers:{'Content-Type':'application/wasm'}});
self.onmessage=async({data})=>{
 const {language,code,stdin=''}=data;
 if(!['c','cpp','python','javascript'].includes(language)||typeof code!=='string'||code.length>MAX_SOURCE||typeof stdin!=='string'||stdin.length>MAX_STDIN){self.postMessage({type:'error',message:'Invalid code or input.'});return;}
 let outputSize=0,pending={stdout:'',stderr:''};
 const flush=()=>{for(const stream of ['stdout','stderr'])if(pending[stream]){self.postMessage({type:'output',stream,text:pending[stream]});pending[stream]='';}};
 const output=stream=>text=>{const room=MAX_OUTPUT-outputSize;if(text.length>room)throw Error('Output limit reached (100,000 characters).');outputSize+=text.length;pending[stream]+=text;if(pending[stream].length>=2048)flush();};
 const phase=text=>{flush();self.postMessage({type:'status',text});};
 let input=stdin;
 const read=limit=>{
  if(!input)return null;
  let text='',bytes=0;
  for(const char of input){const size=new TextEncoder().encode(char).length;if(bytes+size>limit)break;text+=char;bytes+=size;}
  input=input.slice(text.length);return text||null;
 };
 const execute=(binary,fs,args,env={})=>WASI.start(wasm(binary),{fs,args,env,stdin:read,stdout:output('stdout'),stderr:output('stderr'),isTTY:false});
 const stamp=new Date(),extension={c:'c',cpp:'cpp',python:'py',javascript:'js'}[language],path='/main.'+extension;
 let fs={[path]:{path,mode:'string',content:code,timestamps:{access:stamp,modification:stamp,change:stamp}}};
 try{
  phase('Loading browser runtime…');
  let result;
  if(language==='c'||language==='cpp'){
   const [compiler,linker,archive]=await Promise.all([asset('clang.wasm'),asset('wasm-ld.wasm'),asset('clang-fs.tar.gz')]);
   fs={...readTar(gunzipSync(archive)),...fs};
   phase('Compiling…');
   const include=language==='cpp'?['-internal-isystem','/sys/include/c++/v1']:[];
   result=await execute(compiler,fs,['clang','-cc1','-triple','wasm32-unknown-wasi','-isysroot','/sys',...include,'-internal-isystem','/sys/include','-internal-isystem','/sys/lib/clang/8.0.1/include','-ferror-limit','5','-O0','-emit-obj','-x',language==='cpp'?'c++':'c','-std='+ (language==='cpp'?'c++17':'c11'),'-o','/program.o',path]);
   if(result.exitCode===0){
    phase('Linking…');
    result=await execute(linker,result.fs,['wasm-ld','--no-threads','--export-dynamic','-z','stack-size=1048576','-L/sys/lib/wasm32-wasi','/sys/lib/wasm32-wasi/crt1.o','/program.o','-lc',...(language==='cpp'?['-lc++','-lc++abi']:[]),'-o','/program.wasm']);
    if(result.exitCode===0){phase('Running…');const binary=result.fs['/program.wasm'];if(!binary||binary.mode!=='binary')throw Error('Compiler did not produce a program.');result=await execute(binary.content,result.fs,['program']);}
   }
  }else if(language==='python'){
   const [binary,archive]=await Promise.all([asset('python-3.11.3.wasm'),asset('python-3.11.3.tar.gz')]);
   fs={...readTar(gunzipSync(archive)),...fs};phase('Running…');
   result=await execute(binary,fs,['python',path],{PYTHONHOME:'/usr/local',PYTHONIOENCODING:'utf-8'});
  }else{
   const binary=await asset('wasmedge_quickjs.wasm');phase('Running…');
   result=await execute(binary,fs,['quickjs',path]);
  }
  flush();self.postMessage({type:'done',exitCode:result.exitCode});
 }catch(error){flush();self.postMessage({type:'error',message:error.message||'Your browser could not run this program.'});}
};
