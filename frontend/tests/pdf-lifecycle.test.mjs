import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePDFTask,closePDF} from '../src/lib/pdf-lifecycle.mjs';

test('PDF.js 6 proxy without destroy closes through its loading task once',async()=>{
 let calls=0;const proxy={numPages:1},controller=new AbortController();
 const pdf=await resolvePDFTask({promise:Promise.resolve(proxy),destroy:async()=>{calls++;}},controller.signal);
 assert.equal(pdf.destroy,undefined);
 await closePDF(pdf);await closePDF(pdf);controller.abort();
 assert.equal(calls,1);
});
test('abort during loading closes task and preserves AbortError',async()=>{
 const controller=new AbortController();let calls=0,reject;
 const promise=new Promise((_,r)=>{reject=r;});
 const pending=resolvePDFTask({promise,destroy:async()=>{calls++;reject(Error('Worker destroyed'));}},controller.signal);
 controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);
});
test('loading error survives cleanup failure',async()=>{
 await assert.rejects(resolvePDFTask({promise:Promise.reject(Error('Invalid PDF')),destroy:async()=>{throw Error('Cleanup failure');}}),/Invalid PDF/);
});
test('already-aborted load still observes loading promise rejection',async()=>{
 const controller=new AbortController();controller.abort();let reject,calls=0;
 const promise=new Promise((_,r)=>{reject=r;});
 await assert.rejects(resolvePDFTask({promise,destroy:async()=>{calls++;reject(Error('Loading cancelled'));}},controller.signal),{name:'AbortError'});
 assert.equal(calls,1);
});
test('closing a resolved document after cancellation does not destroy twice',async()=>{
 const controller=new AbortController();let calls=0;
 const pdf=await resolvePDFTask({promise:Promise.resolve({numPages:1}),destroy:async()=>{calls++;}},controller.signal);
 controller.abort();await closePDF(pdf);assert.equal(calls,1);
});
test('installed PDF.js extracts real PDF text and releases its worker',async()=>{
 const {PDFDocument}=await import('pdf-lib');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const source=await PDFDocument.create();source.addPage().drawText('PDF cleanup regression');
 const pdf=await resolvePDFTask(pdfjs.getDocument({data:await source.save(),useSystemFonts:true}));
 try{const page=await pdf.getPage(1);assert.equal((await page.getTextContent()).items.map(i=>i.str).join(' '),'PDF cleanup regression');}
 finally{await closePDF(pdf);}
});
