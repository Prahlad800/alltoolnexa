import {overlayPosition} from './pdf-tools.mjs';

// Positions use the visible, rotated crop box. Original page content is retained.
export async function exportPDFEdits(bytes, plans) {
 const {PDFDocument,degrees}=await import('pdf-lib');
 const source=await PDFDocument.load(bytes,{updateMetadata:false});
 if(!Array.isArray(plans)||!plans.length)throw Error('Keep at least one page.');
 const seen=new Set();
 for(const plan of plans){
  if(!Number.isInteger(plan.sourceIndex)||plan.sourceIndex<0||plan.sourceIndex>=source.getPageCount()||seen.has(plan.sourceIndex))throw Error('Invalid or duplicate page selection.');
  if(!Number.isInteger(plan.rotation)||plan.rotation%90!==0)throw Error('Rotation must be a multiple of 90 degrees.');
  seen.add(plan.sourceIndex);
 }
 const out=await PDFDocument.create();
 for(const plan of plans){
  const [page]=await out.copyPages(source,[plan.sourceIndex]);
  out.addPage(page);
  const angle=((page.getRotation().angle+plan.rotation)%360+360)%360;
  page.setRotation(degrees(angle));
  if(plan.overlayPng){
   const image=await out.embedPng(plan.overlayPng),crop=page.getCropBox();
   const width=angle%180?crop.height:crop.width,height=angle%180?crop.width:crop.height;
   const pos=overlayPosition(page,0,0);
   page.drawImage(image,{x:pos.x,y:pos.y,width,height,rotate:degrees(pos.angle)});
  }
 }
 return out.save();
}

export function paintAnnotations(ctx,annotations,width,height) {
 ctx.clearRect(0,0,width,height);
 for(const mark of annotations){
  ctx.save();ctx.strokeStyle=mark.color;ctx.fillStyle=mark.color;ctx.lineWidth=mark.size*width;ctx.lineCap='round';ctx.lineJoin='round';
  if(mark.kind==='text'){
   ctx.font=`${mark.size*width}px Arial, sans-serif`;ctx.textBaseline='top';
   mark.text.split('\n').forEach((line,i)=>ctx.fillText(line,mark.x*width,mark.y*height+i*mark.size*width*1.25));
  }else if(mark.kind==='draw'){
   if(mark.points.length){ctx.beginPath();mark.points.forEach(([x,y],i)=>i?ctx.lineTo(x*width,y*height):ctx.moveTo(x*width,y*height));if(mark.points.length===1){ctx.lineTo(mark.points[0][0]*width+.1,mark.points[0][1]*height+.1);}ctx.stroke();}
  }else{
   ctx.globalAlpha=mark.kind==='highlight'?.3:1;ctx.fillStyle=mark.kind==='whiteout'?'#ffffff':mark.color;
   ctx.fillRect(Math.min(mark.x,mark.x2)*width,Math.min(mark.y,mark.y2)*height,Math.abs(mark.x2-mark.x)*width,Math.abs(mark.y2-mark.y)*height);
  }
  ctx.restore();
 }
}
