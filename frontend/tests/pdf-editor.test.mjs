import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,degrees,decodePDFRawStream} from 'pdf-lib';
import {exportPDFEdits,paintAnnotations} from '../src/lib/pdf-editor.mjs';
import {resolvePDFTask,closePDF} from '../src/lib/pdf-lifecycle.mjs';

async function fixture(){const doc=await PDFDocument.create();for(let i=0;i<3;i++){const page=doc.addPage([300+i*10,400]);page.drawText(`Original page ${i+1}`);}return doc.save();}
test('PDF editor exports deletion, ordering and rotation while preserving original selectable text',async()=>{
 const bytes=await exportPDFEdits(await fixture(),[{sourceIndex:2,rotation:90},{sourceIndex:0,rotation:180}]);
 const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),2);assert.deepEqual(doc.getPages().map(p=>p.getRotation().angle),[90,180]);assert.deepEqual(doc.getPages().map(p=>p.getWidth()),[320,300]);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await resolvePDFTask(pdfjs.getDocument({data:bytes,useSystemFonts:true}));
 try{assert.equal((await (await pdf.getPage(1)).getTextContent()).items.map(i=>i.str).join(''),'Original page 3');assert.equal((await (await pdf.getPage(2)).getTextContent()).items.map(i=>i.str).join(''),'Original page 1');}finally{await closePDF(pdf);}
});
test('editor rejects empty, duplicate, missing and invalid rotation plans',async()=>{
 const bytes=await fixture();
 await assert.rejects(exportPDFEdits(bytes,[]),/Keep at least/);
 await assert.rejects(exportPDFEdits(bytes,[{sourceIndex:3,rotation:0}]),/Invalid/);
 await assert.rejects(exportPDFEdits(bytes,[{sourceIndex:0,rotation:0},{sourceIndex:0,rotation:0}]),/duplicate/);
 await assert.rejects(exportPDFEdits(bytes,[{sourceIndex:0,rotation:45}]),/multiple of 90/);
});
test('editor embeds transparent overlays on cropped and already rotated pages',async()=>{
 const source=await PDFDocument.create(),page=source.addPage([400,500]);page.setCropBox(20,30,300,400);page.setRotation(degrees(90));page.drawText('Still extractable');
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64'));
 const bytes=await exportPDFEdits(await source.save(),[{sourceIndex:0,rotation:180,overlayPng:png}]);
 const doc=await PDFDocument.load(bytes),result=doc.getPage(0);assert.equal(result.getRotation().angle,270);assert.deepEqual(result.getCropBox(),{x:20,y:30,width:300,height:400});
 assert.ok(result.node.Resources().toString().includes('XObject'));
 const contents=result.node.Contents(),streams=Array.from({length:contents.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(doc.context.lookup(contents.get(i))).decode())).join('\n');
 const matrices=[...streams.matchAll(/([\d. eE+\-]+) cm/g)].map(match=>match[1].trim().split(/\s+/).map(Number));
 assert.ok(matrices.some(m=>m[0]===1&&m[3]===1&&m[4]===20&&m[5]===430),'Overlay starts at the rotated crop-box origin');
 assert.ok(matrices.some(m=>Math.abs(m[0])<1e-10&&Math.abs(m[1]+1)<1e-10&&Math.abs(m[2]-1)<1e-10&&Math.abs(m[3])<1e-10),'Overlay follows the page rotation');
 assert.ok(matrices.some(m=>m[0]===400&&m[3]===300),'Overlay is scaled to visible cropped page dimensions');
});
test('annotation painter scales normalized coordinates, uses transparent highlight and restores opacity',()=>{
 const calls=[],ctx={save(){calls.push(['save']);},restore(){calls.push(['restore']);},clearRect(...args){calls.push(['clear',...args]);},fillRect(...args){calls.push(['rect',this.globalAlpha,this.fillStyle,...args]);},fillText(...args){calls.push(['text',...args]);},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 paintAnnotations(ctx,[{kind:'highlight',x:.8,y:.6,x2:.2,y2:.1,color:'#ffff00'},{kind:'whiteout',x:0,y:0,x2:.5,y2:.5},{kind:'text',x:.1,y:.2,text:'नमस्ते\nWorld',size:.05,color:'#000000'}],200,400);
 const rects=calls.filter(c=>c[0]==='rect');assert.deepEqual(rects[0].slice(1),[.3,'#ffff00',40,40,120.00000000000001,200]);assert.deepEqual(rects[1].slice(1),[1,'#ffffff',0,0,100,200]);assert.deepEqual(calls.filter(c=>c[0]==='text'),[['text','नमस्ते',20,80],['text','World',20,92.5]]);assert.equal(calls.filter(c=>c[0]==='restore').length,3);
});
