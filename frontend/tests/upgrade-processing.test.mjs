import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
import {processPDF} from '../src/lib/pdf-tools.mjs';
import {processImageBatch} from '../src/lib/image-batch.mjs';
import {resolveTool} from '../shared/catalog.mjs';

test('crop output preserves pages, rotation and content while adjusting selected boundaries',async()=>{
 const doc=await PDFDocument.create();const page=doc.addPage([200,400]);page.setCropBox(10,20,180,360);page.drawText('Retained content');doc.addPage([300,500]);
 const file=new File([await doc.save()],'sample.pdf',{type:'application/pdf'});
 const result=await processPDF('crop',{unit:'percent',left:10,right:20,top:5,bottom:10,scope:'selected',pages:'1'},[file]);
 const out=await PDFDocument.load(await result.blob.arrayBuffer());assert.equal(out.getPageCount(),2);assert.deepEqual(out.getPage(0).getCropBox(),{x:28,y:56,width:126,height:306});assert.equal(out.getPage(1).getCropBox().width,300);assert.ok(out.getPage(0).node.Contents());assert.match(result.warning,/not secure redaction/);
 await assert.rejects(()=>processPDF('crop',{left:50,right:50},[file]),/visible area/);
 await assert.rejects(()=>processPDF('crop',{left:-1},[file]),/non-negative/);
 await assert.rejects(()=>processPDF('crop',{scope:'selected',pages:'3'},[file]));
 const points=await processPDF('crop',{unit:'pt',left:10,right:10,top:10,bottom:10},[file]);const pointDoc=await PDFDocument.load(await points.blob.arrayBuffer());assert.equal(pointDoc.getPage(0).getCropBox().width,160);
 assert.equal(resolveTool('pdf-crop').id,'crop-pdf');
});

test('100 images continue automatically in two batches with ordered unique ZIP names',async()=>{
 const files=Array.from({length:100},(_,i)=>({name:i<2?'same.png':`image-${i}.png`})),progress=[],order=[];
 // Use bytes accepted in Node and browsers; the browser encoder is tested separately.
 const result=await processImageBatch(files,async(file,index)=>{order.push(index);return {blob:{type:'image/png',size:1,data:new Uint8Array([index])}};},{onProgress:p=>progress.push(p),makeZip:async()=>{const zip=new JSZip();return {file:(name,blob)=>zip.file(name,blob.data),generateAsync:options=>zip.generateAsync(options)};}});
 const zip=await JSZip.loadAsync(await result.blob.arrayBuffer());assert.equal(Object.keys(zip.files).length,100);assert.ok(zip.file('same.png'));assert.ok(zip.file('same-2.png'));assert.deepEqual(order,Array.from({length:100},(_,i)=>i));assert.equal(progress[49].batch,1);assert.equal(progress[50].batch,2);assert.equal(progress[99].completed,100);assert.equal(resolveTool('batch-image-resize').multiple,true);
});

test('batch cancellation prevents processing remaining images',async()=>{
 const controller=new AbortController();let count=0;
 await assert.rejects(()=>processImageBatch([{name:'a.png'},{name:'b.png'}],async()=>{count++;controller.abort();return {blob:new Blob(['a'],{type:'image/png'})};},{signal:controller.signal}),{name:'AbortError'});assert.equal(count,1);
});
