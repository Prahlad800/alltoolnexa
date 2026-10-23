import {cp,mkdir,copyFile,writeFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json'));
const pdf=path.dirname(require.resolve('pdfjs-dist/package.json'));
const html=path.dirname(require.resolve('html-minifier-terser/package.json'));
const out=path.join(root,'public/vendor');
await mkdir(out,{recursive:true});
// Use the upstream browser bundle: the package ESM entry imports node:fs.
await copyFile(path.join(path.dirname(require.resolve('pptxgenjs')),'pptxgen.bundle.js'),path.join(out,'pptxgen.bundle.js'));
await copyFile(path.join(pdf,'legacy/build/pdf.worker.min.mjs'),path.join(out,'pdf.worker.min.mjs'));
for(const [src,dest] of [['cmaps','cmaps'],['standard_fonts','standard_fonts'],['wasm','pdf-wasm']])await cp(path.join(pdf,src),path.join(out,dest),{recursive:true});
await copyFile(path.join(html,'dist/htmlminifier.umd.bundle.min.js'),path.join(out,'htmlminifier.min.js'));
await writeFile(path.join(out,'html-minifier.worker.js'),`importScripts('/vendor/htmlminifier.min.js');
self.onmessage=async({data})=>{try{const text=await HTMLMinifier.minify(data.text,{collapseWhitespace:true,conservativeCollapse:true,removeComments:true,minifyJS:false,minifyCSS:false});self.postMessage({text});}catch(e){self.postMessage({error:e.message});}};\n`);
await writeFile(path.join(out,'versions.json'),JSON.stringify({pdfjs:require('pdfjs-dist/package.json').version,htmlMinifier:require('html-minifier-terser/package.json').version})+'\n');
for(const file of ['pdf.worker.min.mjs','cmaps','standard_fonts','pdf-wasm','htmlminifier.min.js','html-minifier.worker.js'])await access(path.join(out,file));
console.log('Local PDF and HTML workers prepared from installed package versions.');
