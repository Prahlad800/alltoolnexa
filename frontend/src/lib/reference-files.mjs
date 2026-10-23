import {resolvePDFTask,closePDF} from './pdf-lifecycle.mjs';
import {integer,number,escapeHTML} from '../../shared/core.mjs';
import {formatBytes} from './file-input.mjs';

export function selectedPages(value,total){
 if(!String(value||'').trim())return Array.from({length:total},(_,i)=>i+1);
 const pages=[];
 for(const part of String(value).split(',')){const match=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);if(!match)throw Error('Use page numbers or ranges such as 1-3,5.');const start=integer(match[1],'Page',1,total),end=integer(match[2]||match[1],'Page',1,total);if(end<start)throw Error('Page ranges must increase.');for(let i=start;i<=end;i++)pages.push(i);if(pages.length>1000)throw Error('Choose at most 1,000 pages.');}
 return [...new Set(pages)];
}
export function pdfTextRows(items){
 const rows=[];
 for(const item of items){if(typeof item.str!=='string')continue;const y=Number(item.transform?.[5]||0),x=Number(item.transform?.[4]||0);let row=rows.find(r=>Math.abs(r.y-y)<2);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,text:item.str});}
 return rows.sort((a,b)=>b.y-a.y).map(row=>({y:row.y,items:row.items.sort((a,b)=>a.x-b.x)}));
}
export function rowsText(rows){return rows.map(row=>row.items.map(item=>item.text).join(' ')).join('\n');}
export async function loadPDF(file,password,signal){
 signal?.throwIfAborted();
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.mjs';
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),password:String(password||''),isEvalSupported:false,useSystemFonts:true,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/pdf-wasm/'});
 try{return await resolvePDFTask(task,signal);}catch(error){signal?.throwIfAborted();if(error.name==='PasswordException')throw Error('Enter the correct PDF opening password.');throw Error('Could not read this PDF. Check the file and retry. '+error.message);}
}
export async function renderPage(page,scale=1.5,signal){
 signal?.throwIfAborted();
 const viewport=page.getViewport({scale}),c=document.createElement('canvas');
 if(viewport.width*viewport.height>16000000||Math.max(viewport.width,viewport.height)>12000)throw Error('Page is too large at this scale. Lower the render scale.');
 c.width=Math.max(1,Math.ceil(viewport.width));c.height=Math.max(1,Math.ceil(viewport.height));
 const task=page.render({canvasContext:c.getContext('2d'),viewport,background:'rgb(255,255,255)'}),abort=()=>task.cancel();signal?.addEventListener('abort',abort,{once:true});
 try{await task.promise;signal?.throwIfAborted();return c;}catch(e){c.width=1;c.height=1;signal?.throwIfAborted();throw e;}finally{signal?.removeEventListener('abort',abort);}
}
async function canvasBlob(c,type='image/png',quality=.9){const blob=await new Promise(resolve=>c.toBlob(resolve,type,quality));if(!blob)throw Error('Could not encode the rendered page.');return blob;}
async function zipBlob(files){const {default:JSZip}=await import('jszip'),zip=new JSZip();for(const [name,data] of files)zip.file(name,data);return zip.generateAsync({type:'blob',compression:'DEFLATE'});}
export async function rowsWorkbook(pages){
 const {default:JSZip}=await import('jszip'),zip=new JSZip();
 const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
 const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rels='http://schemas.openxmlformats.org/package/2006/relationships';
 zip.file('[Content_Types].xml',xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+pages.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'));
 zip.file('_rels/.rels',xml('<Relationships xmlns="'+rels+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'));
 zip.file('xl/workbook.xml',xml('<workbook xmlns="'+main+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+pages.map((p,i)=>'<sheet name="Page '+p.page+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'));
 zip.file('xl/_rels/workbook.xml.rels',xml('<Relationships xmlns="'+rels+'">'+pages.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'));
 for(const [i,p] of pages.entries()){
  const lines=[['Y position','X position','Text'],...p.rows.flatMap(row=>row.items.map(item=>[row.y,item.x,item.text]))];
  const cells=lines.map((line,r)=>'<row r="'+(r+1)+'">'+line.map((value,c)=>{const ref=String.fromCharCode(65+c)+(r+1);return typeof value==='number'?'<c r="'+ref+'"><v>'+value+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+escapeHTML(String(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')+'</t></is></c>';}).join('')+'</row>').join('');
  zip.file('xl/worksheets/sheet'+(i+1)+'.xml',xml('<worksheet xmlns="'+main+'"><cols><col min="1" max="2" width="16" customWidth="1"/><col min="3" max="3" width="80" customWidth="1"/></cols><sheetData>'+cells+'</sheetData></worksheet>'));
 }
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
export async function protectDocument(bytes,password){
 if(!String(password).length)throw Error('Enter a new opening password.');
 if(new TextEncoder().encode(String(password)).length>127)throw Error('Use a password of at most 127 UTF-8 bytes.');
 const {PDFDocument}=await import('@cantoo/pdf-lib');const doc=await PDFDocument.load(bytes);
 doc.encrypt({userPassword:String(password),ownerPassword:String(password),algorithm:'AES-256'});
 return doc.save();
}
export async function unlockDocument(bytes,password){
 const {PDFDocument}=await import('@cantoo/pdf-lib');let source;
 try{source=await PDFDocument.load(bytes,{password:String(password||'')});}catch{throw Error('Could not decrypt PDF. Check the opening password and file.');}
 const out=await PDFDocument.create();for(const page of await out.copyPages(source,source.getPageIndices()))out.addPage(page);return out.save();
}
export async function textDocumentPDF(text){
 if(!String(text).trim())throw Error('No readable text found. Image-only documents need OCR.');
 if(text.length>500000)throw Error('Use text below 500,000 characters.');
 const {PDFDocument}=await import('pdf-lib'),doc=await PDFDocument.create();
 const c=document.createElement('canvas');c.width=1240;c.height=1754;const ctx=c.getContext('2d');ctx.font='24px Arial, sans-serif';
 const lines=[];for(const paragraph of String(text).split(/\r?\n/)){let line='';for(const {segment:char} of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(paragraph)){if(ctx.measureText(line+char).width>1080){lines.push(line);line='';}line+=char;}lines.push(line);}
 if(lines.length>8000)throw Error('Use a shorter document.');
 for(let start=0;start<lines.length;start+=47){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#17243e';ctx.font='24px Arial, sans-serif';lines.slice(start,start+47).forEach((line,i)=>ctx.fillText(line,80,110+i*32));const blob=await canvasBlob(c,'image/png'),img=await doc.embedPng(await blob.arrayBuffer()),page=doc.addPage([595.28,841.89]);page.drawImage(img,{x:0,y:0,width:595.28,height:841.89});}
 return new Blob([await doc.save()],{type:'application/pdf'});
}
export async function processReferenceFile(tool,v,files,{signal}={}){
 signal?.throwIfAborted();
 const mode=tool.mode,file=files[0];
 if(!tool.noFile&&!file)throw Error('Choose a file first.');
 if(mode==='html-pdf'){const doc=new DOMParser().parseFromString(v.text,'text/html');doc.querySelectorAll('script,style,iframe,object,embed,template').forEach(el=>el.remove());doc.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));doc.querySelectorAll('p,div,h1,h2,h3,h4,li,tr').forEach(el=>el.append('\n'));return {blob:await textDocumentPDF(doc.body.textContent),filename:'document.pdf',text:'Text-only PDF ready. HTML styling and images were omitted.'};}
 if(mode==='word-pdf'){if(!file.name.toLowerCase().endsWith('.docx'))throw Error('Choose a DOCX file. Legacy .doc is not supported.');const importedModule=await import('mammoth/mammoth.browser'),mammoth=importedModule.default||importedModule;const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return {blob:await textDocumentPDF(result.value),filename:'document.pdf',text:'Text-only PDF ready. Original layout, tables and images were omitted.'};}
 if(mode==='protect'||mode==='unlock'){const bytes=await file.arrayBuffer();return {blob:new Blob([await(mode==='protect'?protectDocument(bytes,v.password):unlockDocument(bytes,v.password))],{type:'application/pdf'}),filename:mode==='protect'?'protected.pdf':'unlocked.pdf',text:mode==='protect'?'AES-256 encrypted PDF ready. Keep the opening password.':'Decrypted pages copied to a fresh PDF. Document-level forms, attachments and signatures were not retained.'};}
 if(mode==='compress'&&v.strategy!=='rasterize'){
  const {PDFDocument}=await import('pdf-lib');let doc;try{doc=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});}catch{throw Error('Choose a valid unlocked PDF for lossless repacking. Use Unlock PDF first if needed.');}
  signal?.throwIfAborted();const packed=new Blob([await doc.save({useObjectStreams:true})],{type:'application/pdf'});signal?.throwIfAborted();const smaller=packed.size<file.size,blob=smaller?packed:new Blob([await file.arrayBuffer()],{type:'application/pdf'});
  return {blob,filename:'repacked.pdf',pageCount:doc.getPageCount(),text:`${doc.getPageCount()} pages · ${formatBytes(blob.size)}\n${smaller?'Lossless repacking reduced file size.':'Size did not reduce. Original PDF bytes retained.'}\nText, links and forms retained. Re-saving invalidates digital signatures; keep the original.`};
 }
 if(mode==='compress'&&v.consent!=='yes')throw Error('Rasterization removes selectable text, links, forms, attachments and signatures. Set acceptance to yes, or choose preserve mode.');
 const pdf=await loadPDF(file,v.password,signal);
 try{
  const pages=selectedPages(v.pages,pdf.numPages),rendered=['jpg','png','pptx','compress'].includes(mode);
  if(pages.length>(rendered?40:200))throw Error('Choose at most '+(rendered?40:200)+' pages per run.');
  if(!rendered){
   const extracted=[];
   for(const n of pages){signal?.throwIfAborted();const page=await pdf.getPage(n),content=await page.getTextContent();extracted.push({page:n,rows:pdfTextRows(content.items)});page.cleanup();}
   const text=extracted.map(p=>rowsText(p.rows)).join('\n\n');
   if(!text.trim())throw Error('No selectable text found. Scanned PDFs need OCR.');
   if(mode==='xlsx')return {blob:await rowsWorkbook(extracted),filename:'pdf-text.xlsx',text:'Text items and coordinates extracted. Review column and reading order in your spreadsheet.'};
   if(mode==='docx'){const {Document,Packer,Paragraph,PageBreak}=await import('docx');const children=[];extracted.forEach((p,i)=>{if(i)children.push(new Paragraph({children:[new PageBreak()]}));for(const row of p.rows)children.push(new Paragraph(row.items.map(item=>item.text).join(' ')));});const doc=new Document({sections:[{children}]});return {blob:await Packer.toBlob(doc),filename:'pdf-text.docx',text:'Editable text document ready. PDF layout, images and tables were not preserved.'};}
   if(mode==='html'){const html='<!doctype html><html lang="en"><meta charset="utf-8"><title>PDF text export</title><body>'+extracted.map(p=>'<section><h2>Page '+p.page+'</h2><pre style="white-space:pre-wrap">'+escapeHTML(rowsText(p.rows))+'</pre></section>').join('')+'</body></html>';return {blob:new Blob([html],{type:'text/html;charset=utf-8'}),text,filename:'pdf-text.html'};}
   return {text,filename:'pdf-text.txt'};
  }
  const scale=number(v.scale||1.5,'Scale',.5,3),quality=number(v.quality||.85,'Quality',.2,1),results=[];
  let output,presentation;
  if(mode==='compress'){const {PDFDocument}=await import('pdf-lib');output=await PDFDocument.create();}
  if(mode==='pptx'){const {loadPptxBrowser}=await import('./pptx-browser.mjs');const PptxGenJS=await loadPptxBrowser();presentation=new PptxGenJS();presentation.author='AllToolNexa';presentation.subject='PDF pages rendered as slide images';}
  let slideWidth,slideHeight;
  for(const n of pages){signal?.throwIfAborted();const page=await pdf.getPage(n),c=await renderPage(page,scale,signal);try{const blob=await canvasBlob(c,mode==='png'?'image/png':'image/jpeg',quality);
   if(mode==='compress'){const image=await output.embedJpg(await blob.arrayBuffer()),viewport=page.getViewport({scale:1}),outPage=output.addPage([viewport.width,viewport.height]);outPage.drawImage(image,{x:0,y:0,width:viewport.width,height:viewport.height});}
   else if(mode==='pptx'){const viewport=page.getViewport({scale:1});if(!slideWidth){slideWidth=viewport.width/72;slideHeight=viewport.height/72;presentation.defineLayout({name:'PDF_PAGE',width:slideWidth,height:slideHeight});presentation.layout='PDF_PAGE';}const factor=Math.min(slideWidth/(viewport.width/72),slideHeight/(viewport.height/72)),w=viewport.width/72*factor,h=viewport.height/72*factor,slide=presentation.addSlide();slide.background={color:'FFFFFF'};slide.addImage({data:c.toDataURL('image/jpeg',quality),x:(slideWidth-w)/2,y:(slideHeight-h)/2,w,h});}
   else results.push(['page-'+n+'.'+mode,await blob.arrayBuffer()]);
   }finally{c.width=1;c.height=1;page.cleanup();}
  }
  if(mode==='compress'){const blob=new Blob([await output.save()],{type:'application/pdf'});return {blob,filename:'compressed.pdf',text:'Image-based PDF ready. Selectable text, links, forms and vector detail were removed.\nOriginal: '+file.size+' bytes\nOutput: '+blob.size+' bytes\nChange: '+((1-blob.size/file.size)*100).toFixed(1)+'% smaller (negative means larger).'};}
  if(mode==='pptx')return {blob:await presentation.write({outputType:'blob',compression:true}),filename:'pdf-pages.pptx',text:pages.length+' slides created. Each PDF page is an image; text is not editable. Pages fit within the first selected page size, centered without cropping or stretching.'};
  return results.length===1?{blob:new Blob([results[0][1]],{type:mode==='png'?'image/png':'image/jpeg'}),preview:true,filename:results[0][0],text:'PDF page rendered locally.'}:{blob:await zipBlob(results),filename:'pdf-pages.zip',text:results.length+' page images ready in one ZIP.'};
 }finally{await closePDF(pdf);}
}
