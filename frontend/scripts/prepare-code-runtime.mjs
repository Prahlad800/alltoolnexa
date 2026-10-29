import {readFile,writeFile,mkdir,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {RUNTIME_COMMIT,RUNTIME_BASE,RUNTIME_ASSETS,assetFile} from '../shared/code-runtime-manifest.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'public',RUNTIME_BASE);
await mkdir(out,{recursive:true});
const valid=(data,asset)=>data.length===asset.bytes&&createHash('sha256').update(data).digest('hex')===asset.sha256;
for(const asset of RUNTIME_ASSETS){
 let cached;
 try{const packed=await readFile(path.join(out,assetFile(asset)));cached=asset.name.endsWith('.wasm')?gunzipSync(packed):packed;}catch{/* Refresh missing or corrupt generated assets. */}
 if(cached&&valid(cached,asset))continue;
 const temporary=path.join(out,asset.name+'.download');
 try{
  console.log('Preparing browser code runtime:',asset.name);
  execFileSync('curl',['--fail','--location','--retry','2','--max-time','180','--silent','--show-error','--output',temporary,`https://raw.githubusercontent.com/taybenlor/runno/${RUNTIME_COMMIT}/langs/${asset.name}`],{stdio:'inherit'});
  const data=await readFile(temporary);
  if(!valid(data,asset))throw Error('Runtime integrity check failed: '+asset.name);
  const packed=asset.name.endsWith('.wasm')?gzipSync(data,{level:9}):data;
  if(packed.length>24*1024*1024)throw Error('Runtime exceeds the static hosting asset limit: '+asset.name);
  await writeFile(path.join(out,assetFile(asset)),packed);
 }finally{await unlink(temporary).catch(()=>{});}
}
// Remove only this generator's obsolete chunk outputs from the earlier format.
for(const name of await readdir(out))if(RUNTIME_ASSETS.some(asset=>new RegExp('^'+asset.name.replaceAll('.','\\.')+'\\.part[0-9]+$').test(name)))await unlink(path.join(out,name));
await build({entryPoints:[path.join(root,'src/lib/code-runner.worker.js')],outfile:path.join(out,'runner.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
console.log('Browser code runtimes verified, compressed and bundled for static hosting.');
