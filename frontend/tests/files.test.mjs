import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {processPDF,parsePages} from '../src/lib/pdf-tools.mjs';
import {qrPayload} from '../src/lib/qr-payload.mjs';
import {imageDataBlob,processBrowserTool} from '../src/lib/browser-tools.js';

async function fixture(){const pdf=await PDFDocument.create();pdf.setAuthor('Private Author');pdf.setTitle('Private Title');pdf.addPage([200,300]);pdf.addPage([400,500]);pdf.addPage([600,700]);return new File([await pdf.save()], 'sample.pdf',{type:'application/pdf'});}
async function read(result){return PDFDocument.load(await result.blob.arrayBuffer());}
test('merge, extract, reorder and remove actual PDF pages',async()=>{
 const file=await fixture();
 assert.equal((await read(await processPDF('merge',{},[file,file]))).getPageCount(),6);
 const extracted=await read(await processPDF('extract',{pages:'1,3'},[file]));assert.equal(extracted.getPageCount(),2);assert.equal(extracted.getPage(1).getWidth(),600);
 const reordered=await read(await processPDF('reorder',{pages:'3,1,2'},[file]));assert.equal(reordered.getPage(0).getWidth(),600);
 assert.equal((await read(await processPDF('remove',{pages:'1-2'},[file]))).getPageCount(),1);
 await assert.rejects(()=>processPDF('remove',{pages:'1-3'},[file]),/Keep/);
 await assert.rejects(()=>processPDF('reorder',{pages:'1'},[file]),/all 3/);
 assert.throws(()=>parsePages('1,1',3),/duplicates/);assert.throws(()=>parsePages('0',3),/between/);
});
test('PDF rotation, metadata privacy and text pagination',async()=>{
 const file=await fixture();
 assert.equal((await read(await processPDF('rotate',{angle:'90'},[file]))).getPage(0).getRotation().angle,90);
 const cleaned=await read(await processPDF('clean',{},[file]));assert.equal(cleaned.getAuthor(),'');assert.equal(cleaned.getTitle(),'');assert.equal(cleaned.getPageCount(),3);
 const textPDF=await read(await processPDF('text',{text:('a long document line '.repeat(10)+'\n').repeat(100)},[]));assert.ok(textPDF.getPageCount()>1);
 const inspected=await processPDF('inspect',{},[file]);assert.match(inspected.text,/Pages: 3/);
 assert.match((await processPDF('metadata',{},[file])).text,/Private Author/);
 const numbered=await read(await processPDF('numbers',{},[file]));assert.equal(numbered.getPageCount(),3);
 const marked=await read(await processPDF('watermark',{text:'DRAFT'},[file]));assert.equal(marked.getPageCount(),3);
});
test('PNG to PDF and base64 decoding produce valid artifacts',async()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 const blob=imageDataBlob(png);assert.equal(blob.type,'image/png');
 const result=await read(await processPDF('images',{},[new File([blob],'pixel.png',{type:'image/png'})]));assert.equal(result.getPageCount(),1);
 assert.throws(()=>imageDataBlob('data:text/html;base64,SGVsbG8='),/PNG/);
});
test('QR payloads preserve special characters and validate coordinates',()=>{
 assert.equal(qrPayload('wifi',{ssid:'A;B',password:'x:y',security:'WPA'}),'WIFI:T:WPA;S:A\\;B;P:x\\:y;;');
 assert.equal(qrPayload('location',{a:'28.6',b:'77.2'}),'geo:28.6,77.2');
 assert.throws(()=>qrPayload('location',{a:95,b:20}),/between/);
 assert.equal(qrPayload('whatsapp',{phone:'919876543210',text:'hello & welcome'}),'https://wa.me/919876543210?text=hello%20%26%20welcome');
 assert.match(qrPayload('contact',{name:'Asha;Ravi',phone:'+919876543210',email:'a@example.com'}),/FN:Asha\\;Ravi/);
});

test('local YAML, Markdown and code formatters return real parser output',async()=>{
 const yaml=await processBrowserTool({kind:'format',mode:'yaml-json'},{text:'name: tools\nfree: true'},[]);
 assert.equal((await processBrowserTool({kind:'format',mode:'yaml-json'},{text:''},[])).text,'null');
 assert.deepEqual(JSON.parse(yaml.text),{name:'tools',free:true});
 const converted=await processBrowserTool({kind:'format',mode:'json-yaml'},{text:'{"free":true}'},[]);assert.match(converted.text,/free: true/);
 const markdown=await processBrowserTool({kind:'format',mode:'markdown'},{text:'# Hello\n\n**Tools**'},[]);assert.match(markdown.text,/<h1>Hello<\/h1>/);assert.match(markdown.text,/<strong>Tools<\/strong>/);
 const code=await processBrowserTool({kind:'code-format',parser:'babel'},{text:'const add=(a,b)=>a+b'},[]);assert.equal(code.text,'const add = (a, b) => a + b;\n');
 const css=await processBrowserTool({kind:'code-format',parser:'css'},{text:'body{color:red}'},[]);assert.match(css.text,/color: red;/);
 await assert.rejects(()=>processBrowserTool({kind:'format',mode:'yaml-json'},{text:'a: [invalid'},[]));
});
