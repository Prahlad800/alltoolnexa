import {integer} from '../../shared/core.mjs';
import {checkImage,formatBytes} from './file-input.mjs';
export function parsePages(spec,count){
 const result=[];
 for(const part of String(spec||'').split(',')){const m=/^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);if(!m)throw Error('Use page numbers or ascending ranges, e.g. 1,3-5.');const start=integer(m[1],'Page',1,count),end=m[2]?integer(m[2],'Page',start,count):start;for(let n=start;n<=end;n++)result.push(n-1);}
 if(!result.length)throw Error('Select at least one page.');if(new Set(result).size!==result.length)throw Error('Page selections cannot contain duplicates.');return result;
}
export function preflightText(font,text){try{font.encodeText(String(text).replace(/[\n\r\t]/g,''));}catch{throw Error('This PDF tool supports Latin text only. Hindi, emoji and other unsupported characters need a Unicode PDF editor. Your original file has not changed.');}}
export function overlayPosition(page,x,y){const c=page.getCropBox(),angle=((page.getRotation().angle%360)+360)%360;
 if(angle===90)return {x:c.x+c.width-y,y:c.y+x,angle};
 if(angle===180)return {x:c.x+c.width-x,y:c.y+c.height-y,angle};
 if(angle===270)return {x:c.x+y,y:c.y+c.height-x,angle};
 return {x:c.x+x,y:c.y+y,angle:0};
}
export async function processPDF(mode,values,files){
 const {PDFDocument,degrees,rgb,StandardFonts}=await import('pdf-lib');
 const result=async(doc,meta={})=>{const blob=new Blob([await doc.save()],{type:'application/pdf'}),pageCount=doc.getPageCount();return {blob,filename:`alltoolnexa-${mode}.pdf`,pageCount,...meta,text:`PDF ready · ${pageCount} pages · ${formatBytes(blob.size)}${meta.order?'\nPage order: '+meta.order.join(', '):''}${mode==='rotate'?'\nAll pages rotated by '+values.angle+'°':''}`};};
 if(mode==='text'){
  if(!values.text.trim())throw Error('Enter some text first.');if(values.text.length>100000)throw Error('Use text below 100,000 characters.');
  if(/[^\x00-\xff]/.test(values.text)&&typeof document!=='undefined'){const {textDocumentPDF}=await import('./reference-files.mjs');const blob=await textDocumentPDF(values.text);return {blob,filename:'alltoolnexa-text.pdf',warning:'Unicode text rendered as images using device fonts. Text is not selectable.',text:'Unicode PDF ready.'};}
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),size=12,margin=50,width=595.28,height=841.89;preflightText(font,values.text);
  let page=doc.addPage([width,height]),y=height-margin;
  const draw=line=>{if(y<margin){page=doc.addPage([width,height]);y=height-margin;}page.drawText(line,{x:margin,y,font,size});y-=18;};
  for(const paragraph of values.text.replace(/\r/g,'').split('\n')){if(!paragraph){draw('');continue;}let line='';for(const char of paragraph.replace(/\t/g,'    ')){if(font.widthOfTextAtSize(line+char,size)>width-2*margin){draw(line);line='';}line+=char;}draw(line);}
  return result(doc);
 }
 if(!files.length)throw Error('Choose a file first.');
 if(mode==='images'){
  const doc=await PDFDocument.create();
  for(const file of files){await checkImage(file);let bytes=new Uint8Array(await file.arrayBuffer());
   // Normalize EXIF orientation when a browser decoder is available.
   if(typeof createImageBitmap==='function'){const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});let c;try{c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);const png=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!png)throw Error('Could not encode image.');bytes=new Uint8Array(await png.arrayBuffer());}finally{bitmap.close();if(c){c.width=1;c.height=1;}}}
   let image;if(bytes[0]===0x89&&bytes[1]===0x50)image=await doc.embedPng(bytes);else if(bytes[0]===0xff&&bytes[1]===0xd8)image=await doc.embedJpg(bytes);else throw Error('Only PNG and JPEG images can be embedded.');
   const [width,height]=values.orientation==='landscape'?[841.89,595.28]:[595.28,841.89],page=doc.addPage([width,height]),scale=(values.fit==='cover'?Math.max:Math.min)((width-40)/image.width,(height-40)/image.height);page.drawImage(image,{x:(width-image.width*scale)/2,y:(height-image.height*scale)/2,width:image.width*scale,height:image.height*scale});
  }return result(doc);
 }
 const load=async file=>{try{return await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});}catch{throw Error('Could not open this PDF. Choose a valid unlocked PDF or replace the file.');}};
 if(mode==='merge'){if(files.length<2)throw Error('Choose at least two PDFs to merge.');const out=await PDFDocument.create();for(const file of files){const doc=await load(file);for(const page of await out.copyPages(doc,doc.getPageIndices()))out.addPage(page);}return result(out,{fileOrder:files.map(f=>f.name)});}
 const doc=await load(files[0]),count=doc.getPageCount();
 if(mode==='inspect')return {text:`${files[0].name}\nPages: ${count}\nFile size: ${formatBytes(files[0].size)}`};
 if(mode==='metadata'){const validDate=d=>d instanceof Date&&Number.isFinite(d.getTime())?d.toISOString():'';return {text:JSON.stringify({title:doc.getTitle()||'',author:doc.getAuthor()||'',subject:doc.getSubject()||'',keywords:doc.getKeywords()||'',creator:doc.getCreator()||'',producer:doc.getProducer()||'',created:validDate(doc.getCreationDate()),modified:validDate(doc.getModificationDate())},null,2)};}
 if(mode==='sizes')return {text:doc.getPages().map((page,i)=>{const{width,height}=page.getSize();return `Page ${i+1}: ${width.toFixed(2)} × ${height.toFixed(2)} pt (${(width*25.4/72).toFixed(1)} × ${(height*25.4/72).toFixed(1)} mm)`;}).join('\n')};
 if(['extract','reorder','remove'].includes(mode)){const selected=parsePages(values.pages,count);let indices=selected;if(mode==='reorder'&&selected.length!==count)throw Error(`List all ${count} pages exactly once.`);if(mode==='remove'){indices=doc.getPageIndices().filter(i=>!selected.includes(i));if(!indices.length)throw Error('Keep at least one page.');}const out=await PDFDocument.create();for(const page of await out.copyPages(doc,indices))out.addPage(page);return result(out,{order:indices.map(n=>n+1)});}
 if(mode==='clean'){const out=await PDFDocument.create();for(const page of await out.copyPages(doc,doc.getPageIndices()))out.addPage(page);out.setTitle('');out.setAuthor('');out.setSubject('');out.setKeywords([]);out.setCreator('');out.setProducer('');return result(out);}
 if(mode==='rotate')for(const page of doc.getPages())page.setRotation(degrees((page.getRotation().angle+integer(values.angle,'Rotation',0,270))%360));
 if(mode==='numbers'||mode==='watermark'){
  let unicodeImage=null;if(mode==='watermark'&&/[^\x00-\xff]/.test(values.text)&&typeof document!=='undefined'){const c=document.createElement('canvas');c.width=1600;c.height=240;const ctx=c.getContext('2d');ctx.font='64px Arial, sans-serif';ctx.fillStyle='#405940';ctx.fillText(values.text,20,150,1560);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not render watermark.');unicodeImage=await doc.embedPng(await blob.arrayBuffer());c.width=1;c.height=1;}
  const font=await doc.embedFont(StandardFonts.Helvetica);if(mode==='watermark'&&!unicodeImage){if(!values.text.trim())throw Error('Enter a watermark.');preflightText(font,values.text);}
  doc.getPages().forEach((page,i)=>{const crop=page.getCropBox(),rot=page.getRotation().angle%180!==0,width=rot?crop.height:crop.width,height=rot?crop.width:crop.height;if(unicodeImage){const drawWidth=width*.8,drawHeight=drawWidth*240/1600,pos=overlayPosition(page,width*.1,height/2);page.drawImage(unicodeImage,{x:pos.x,y:pos.y,width:drawWidth,height:drawHeight,rotate:degrees(pos.angle),opacity:.25});return;}const margin=Math.min(20,width/10,height/10),text=mode==='numbers'?`${i+1} / ${count}`:values.text,size=Math.max(.1,Math.min(mode==='numbers'?10:48,(width-2*margin)/Math.max(font.widthOfTextAtSize(text,1),1),height/8)),x=mode==='numbers'?(width-font.widthOfTextAtSize(text,size))/2:margin,y=mode==='numbers'?margin:height/2,pos=overlayPosition(page,x,y);page.drawText(text,{x:pos.x,y:pos.y,rotate:degrees(pos.angle),font,size,opacity:mode==='numbers'?1:.25,color:rgb(.25,.35,.25)});});
 }
 return result(doc);
}
