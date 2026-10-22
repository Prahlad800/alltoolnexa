import {integer} from '../../../shared/core.mjs';

export function parsePages(spec,count){
 const result=[];
 for(const part of spec.split(',')){const m=/^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);if(!m)throw Error('Use page numbers or ascending ranges, e.g. 1,3-5.');const start=integer(m[1],'Page',1,count),end=m[2]?integer(m[2],'Page',start,count):start;for(let n=start;n<=end;n++)result.push(n-1);}
 if(!result.length)throw Error('Select at least one page.');
 if(new Set(result).size!==result.length)throw Error('Page selections cannot contain duplicates.');
 return result;
}

export async function processPDF(mode,values,files){
 const {PDFDocument,degrees,rgb,StandardFonts}=await import('pdf-lib');
 const result=bytes=>({blob:new Blob([bytes],{type:'application/pdf'}),filename:`alltoolnexa-${mode}.pdf`});
 if(mode==='text'){
  if(!values.text.trim())throw Error('Enter some text first.');
  if(values.text.length>100000)throw Error('Use text below 100,000 characters.');
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),size=12,margin=50,width=595.28,height=841.89;
  let page=doc.addPage([width,height]),y=height-margin;
  const draw=line=>{if(y<margin){page=doc.addPage([width,height]);y=height-margin;}page.drawText(line,{x:margin,y,font,size});y-=18;};
  for(const paragraph of values.text.replace(/\r/g,'').split('\n')){
   if(!paragraph){draw('');continue;}let line='';
   // Split long words too, to guarantee every line fits inside the page margins.
   for(const char of paragraph.replace(/\t/g,'    ')){if(font.widthOfTextAtSize(line+char,size)>width-2*margin){draw(line);line='';}line+=char;}draw(line);
  }
  return result(await doc.save());
 }
 if(!files.length)throw Error('Choose a file first.');
 if(mode==='images'){
  const doc=await PDFDocument.create();
  for(const file of files){const bytes=new Uint8Array(await file.arrayBuffer());let image;if(bytes[0]===0x89&&bytes[1]===0x50)image=await doc.embedPng(bytes);else if(bytes[0]===0xff&&bytes[1]===0xd8)image=await doc.embedJpg(bytes);else throw Error('Only PNG and JPEG images can be embedded.');const page=doc.addPage([595.28,841.89]),scale=Math.min((595.28-40)/image.width,(841.89-40)/image.height);page.drawImage(image,{x:(595.28-image.width*scale)/2,y:(841.89-image.height*scale)/2,width:image.width*scale,height:image.height*scale});}
  return result(await doc.save());
 }
 const load=async file=>PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});
 if(mode==='merge'){
  if(files.length<2)throw Error('Choose at least two PDFs to merge.');
  const out=await PDFDocument.create();
  for(const file of files){const doc=await load(file);for(const page of await out.copyPages(doc,doc.getPageIndices()))out.addPage(page);}
  return result(await out.save());
 }
 const doc=await load(files[0]),count=doc.getPageCount();
 if(mode==='inspect')return {text:`Pages: ${count}\nFile size: ${files[0].size.toLocaleString()} bytes`};
 if(mode==='metadata')return {text:JSON.stringify({title:doc.getTitle()||'',author:doc.getAuthor()||'',subject:doc.getSubject()||'',keywords:doc.getKeywords()||'',creator:doc.getCreator()||'',producer:doc.getProducer()||'',created:doc.getCreationDate()?.toISOString(),modified:doc.getModificationDate()?.toISOString()},null,2)};
 if(mode==='sizes')return {text:doc.getPages().map((page,i)=>{const{width,height}=page.getSize();return `Page ${i+1}: ${width.toFixed(2)} × ${height.toFixed(2)} pt (${(width*25.4/72).toFixed(1)} × ${(height*25.4/72).toFixed(1)} mm)`;}).join('\n')};
 if(['extract','reorder','remove'].includes(mode)){
  const selected=parsePages(values.pages,count);let indices=selected;
  if(mode==='reorder'&&(selected.length!==count))throw Error(`List all ${count} pages exactly once.`);
  if(mode==='remove'){indices=doc.getPageIndices().filter(i=>!selected.includes(i));if(!indices.length)throw Error('Keep at least one page.');}
  const out=await PDFDocument.create();for(const page of await out.copyPages(doc,indices))out.addPage(page);return result(await out.save());
 }
 if(mode==='clean'){
  // Copy into a new document, excluding source Info and XMP metadata.
  const out=await PDFDocument.create();for(const page of await out.copyPages(doc,doc.getPageIndices()))out.addPage(page);
  out.setTitle('');out.setAuthor('');out.setSubject('');out.setKeywords([]);out.setCreator('');out.setProducer('');
  return result(await out.save());
 }
 if(mode==='rotate')for(const page of doc.getPages())page.setRotation(degrees((page.getRotation().angle+integer(values.angle,'Rotation',0,270))%360));
 if(mode==='numbers'||mode==='watermark'){
  const font=await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page,i)=>{const {width,height}=page.getSize();if(mode==='numbers'){const text=`${i+1} / ${count}`;page.drawText(text,{x:(width-font.widthOfTextAtSize(text,10))/2,y:15,font,size:10,color:rgb(.25,.25,.25)});}else{if(!values.text.trim())throw Error('Enter a watermark.');const size=Math.min(48,(width-40)/Math.max(font.widthOfTextAtSize(values.text,1),1));page.drawText(values.text,{x:20,y:height/2,font,size,opacity:.25,color:rgb(.25,.35,.25)});}});
 }
 return result(await doc.save());
}
