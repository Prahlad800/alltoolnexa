import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {tools,resolveTool,defaults} from '../shared/catalog.mjs';
import {validateFiles,needsFile,checkImage} from '../src/lib/file-input.mjs';
import {processBrowserTool} from '../src/lib/browser-tools.js';
import {processPDF} from '../src/lib/pdf-tools.mjs';
import {matchesTool} from '../src/lib/search.mjs';
test('reference routes and public dispatch are integrated',async()=>{
 assert.equal(tools.length,505);
 for(const id of ['pdf-to-jpg','pdf-compressor','invoice-generator','text-diff-checker','html-minifier'])assert.ok(resolveTool(id));
 assert.equal(needsFile(resolveTool('pdf-to-jpg')),true);assert.equal(needsFile(resolveTool('html-to-pdf')),false);
 assert.equal((await processBrowserTool(resolveTool('md5-generator'),{text:'abc'},[])).text,'900150983cd24fb0d6963f7d28e17f72');
 const invoice=await processBrowserTool(resolveTool('invoice-generator'),defaults(resolveTool('invoice-generator')),[]);assert.ok((await PDFDocument.load(await invoice.blob.arrayBuffer())).getPageCount());
});
test('selection rejects oversized and disguised files before processing',async()=>{
 assert.throws(()=>validateFiles(Array(101).fill({size:1})),/100/);
 assert.throws(()=>validateFiles([{size:50*1024*1024+1}]),/50/);
 assert.throws(()=>validateFiles([{size:1,type:'text/plain',name:'x.txt'}],resolveTool('image-crop')),/supported/);
 await assert.rejects(()=>checkImage(new File(['not an image'],'x.png',{type:'image/png'})),/dimensions/);
});
test('default PDF compression preserves forms and page geometry',async()=>{
 const doc=await PDFDocument.create();const page=doc.addPage([240,320]);doc.getForm().createTextField('name').addToPage(page,{x:20,y:20,width:100,height:20});
 const file=new File([await doc.save()],'form.pdf',{type:'application/pdf'}),tool=resolveTool('pdf-compressor');
 const result=await processBrowserTool(tool,defaults(tool),[file]),out=await PDFDocument.load(await result.blob.arrayBuffer());
 assert.equal(out.getPage(0).getWidth(),240);assert.ok(out.getForm().getTextField('name'));
 await assert.rejects(()=>processBrowserTool(tool,{strategy:'rasterize',consent:'no'},[file]),/acceptance/);
 await assert.rejects(()=>processPDF('text',{text:'नमस्ते'},[]),/Latin/);
});
test('search matches reordered task words and aliases',()=>{assert.ok(matchesTool(resolveTool('pdf-merge'),'merge pdf'));assert.ok(matchesTool(resolveTool('image-resize'),'image resizer'));});
