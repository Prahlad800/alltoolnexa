import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
test('local browser PowerPoint bundle exports a readable PPTX without Node imports',async()=>{
 const source=fs.readFileSync(new URL('../src/lib/reference-files.mjs',import.meta.url),'utf8');
 assert.ok(!source.includes("import('pptxgenjs')"));
 const bundle=new URL('../node_modules/pptxgenjs/dist/pptxgen.bundle.js',import.meta.url);
 const context=vm.createContext({console,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync(bundle,'utf8'),context);
 const deck=new context.PptxGenJS();deck.addSlide().addText('Browser export',{x:1,y:1,w:5,h:1});
 const zip=await JSZip.loadAsync(Buffer.from(await deck.write({outputType:'arraybuffer'})));
 assert.ok(zip.file('ppt/presentation.xml'));
 assert.match(await zip.file('ppt/slides/slide1.xml').async('string'),/Browser export/);
});
