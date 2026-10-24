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

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const visibleFill=fill=>typeof fill==='string'&&fill!==''&&fill!=='none'&&fill!=='transparent';
let measurementContext;
function measuring(){
 if(!measurementContext&&typeof document!=='undefined')measurementContext=document.createElement('canvas').getContext('2d');
 return measurementContext;
}
function textFont(mark,width){
 const size=clamp(finite(mark.size,.025)*width,.5,4096);
 const family=typeof mark.fontFamily==='string'&&/^[\w ,'-]{1,100}$/.test(mark.fontFamily)?mark.fontFamily:'Arial';
 return {size,font:`${mark.italic?'italic ':''}${mark.bold?'bold ':''}${size}px ${family}, sans-serif`};
}
function graphemes(value){return typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value),part=>part.segment):Array.from(value);}

// The same layout routine powers rendering and selection bounds. A caller may
// supply its real canvas context as the fourth bounds argument in Node tests.
function textLayout(mark,width,height,context){
 const ctx=context||measuring(),{size,font}=textFont(mark,width),x=finite(mark.x)*width,y=finite(mark.y)*height;
 if(ctx)ctx.font=font;
 const measure=value=>ctx?.measureText?ctx.measureText(value).width:graphemes(value).length*size*.6;
 const explicit=Number.isFinite(mark.width)&&mark.width>0;
 const boxWidth=explicit?Math.max(1,Math.min(mark.width*width,Math.max(1,width-x))):Infinity;
 const lineHeight=size*clamp(finite(mark.lineSpacing,1.25),.8,3),lines=[];
 const paragraphs=String(mark.text??'').replace(/\r\n?/g,'\n').split('\n');
 for(const [paragraphIndex,paragraph] of paragraphs.entries()){
  const prefix=mark.list==='bullet'?'\u2022 ':mark.list==='number'?`${paragraphIndex+1}. `:'';
  const indent=measure(prefix),available=Math.max(size*.3,boxWidth-indent),wrapped=[];
  if(!explicit)wrapped.push(paragraph);
  else{
   let line='';
   for(const token of paragraph.match(/\S+|\s+/gu)||[]){
    if(/^\s+$/u.test(token)){if(line)line+=token;continue;}
    if(line&&measure(line+token)>available){wrapped.push(line.trimEnd());line='';}
    if(measure(token)<=available)line+=token;
    else for(const glyph of graphemes(token)){if(line&&measure(line+glyph)>available){wrapped.push(line.trimEnd());line='';}line+=glyph;}
   }
   if(line||!wrapped.length)wrapped.push(line.trimEnd());
  }
  for(const [i,line] of wrapped.entries()){
   const lineText=i===0?prefix+line:line;
   const offset=i===0?0:indent,used=offset+measure(lineText);
   lines.push({text:lineText,offset,used,textWidth:measure(lineText)});
  }
 }
 const contentWidth=Math.max(size*.3,...lines.map(line=>line.used)),renderWidth=explicit?boxWidth:contentWidth;
 for(const [i,line] of lines.entries()){
  const align=mark.align==='right'?1:mark.align==='center'?.5:0;
  line.x=x+Math.max(0,renderWidth-line.used)*align+line.offset;line.y=y+i*lineHeight;
 }
 const decoration=mark.underline?1.1:1;
 return {x,y,width:renderWidth,height:(lines.length-1)*lineHeight+size*decoration,size,font,lines};
}
function geometricBounds(mark,width,height){
 const points=mark.kind==='draw'?(mark.points||[]):[[finite(mark.x),finite(mark.y)],[finite(mark.x2,mark.x),finite(mark.y2,mark.y)]];
 if(!points.length)return {x:0,y:0,width:0,height:0};
 const xs=points.map(p=>finite(p[0])*width),ys=points.map(p=>finite(p[1])*height);
 const padding=['draw','line','rectangle','ellipse'].includes(mark.kind)?Math.max(.5,finite(mark.size,.003)*width)/2:0;
 return {x:Math.min(...xs)-padding,y:Math.min(...ys)-padding,width:Math.max(...xs)-Math.min(...xs)+padding*2,height:Math.max(...ys)-Math.min(...ys)+padding*2};
}
export function annotationBounds(mark,width,height,context){
 if(mark.kind==='text'){const layout=textLayout(mark,width,height,context);return {x:layout.x,y:layout.y,width:layout.width,height:layout.height};}
 return geometricBounds(mark,width,height);
}
function distanceToSegment(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy,t=length?clamp(((x-x1)*dx+(y-y1)*dy)/length,0,1):0;return Math.hypot(x-(x1+t*dx),y-(y1+t*dy));}
export function hitTestAnnotation(marks,xNormalized,yNormalized,width,height,context){
 const x=xNormalized*width,y=yNormalized*height;
 for(let i=marks.length-1;i>=0;i--){
  const mark=marks[i];if(mark.kind==='image')continue;
  const bounds=annotationBounds(mark,width,height,context),tolerance=Math.max(4,finite(mark.size,.003)*width/2+3);
  if(['line','draw'].includes(mark.kind)){
   const points=mark.kind==='line'?[[mark.x,mark.y],[mark.x2,mark.y2]]:mark.points||[];
   if(points.length===1&&Math.hypot(x-points[0][0]*width,y-points[0][1]*height)<=tolerance)return i;
   for(let j=1;j<points.length;j++)if(distanceToSegment(x,y,points[j-1][0]*width,points[j-1][1]*height,points[j][0]*width,points[j][1]*height)<=tolerance)return i;
  }else if(bounds.width>0&&bounds.height>0&&x>=bounds.x&&x<=bounds.x+bounds.width&&y>=bounds.y&&y<=bounds.y+bounds.height)return i;
 }
 return -1;
}
export function replaceAnnotationText(pages,find,replacement,caseSensitive=false){
 const needle=String(find??'');if(!needle)return pages;
 // Escape regexp syntax and use a callback so replacement $&, $1 etc stay literal.
 const pattern=new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'gu':'giu');
 let changed=false;
 const updated=pages.map(page=>{
  let pageChanged=false;
  const annotations=(page.annotations||[]).map(mark=>{
   if(mark.kind!=='text')return mark;
   const text=String(mark.text??'').replace(pattern,()=>String(replacement??''));if(text===mark.text)return mark;
   changed=true;pageChanged=true;return {...mark,text};
  });
  return pageChanged?{...page,annotations}:page;
 });
 return changed?updated:pages;
}

export function paintAnnotations(ctx,annotations,width,height){
 ctx.clearRect(0,0,width,height);
 for(const mark of annotations){
  if(mark.kind==='image')continue; // Images require asynchronous decoding, outside this renderer.
  ctx.save();
  try{
   ctx.globalAlpha=clamp(finite(mark.opacity,1),0,1);ctx.strokeStyle=mark.color||'#000000';ctx.fillStyle=mark.color||'#000000';ctx.lineWidth=Math.max(.5,finite(mark.size,.003)*width);ctx.lineCap='round';ctx.lineJoin='round';
   if(mark.kind==='text'){
    const layout=textLayout(mark,width,height,ctx);ctx.font=layout.font;ctx.textBaseline='top';ctx.textAlign='left';
    if(visibleFill(mark.fill)){ctx.fillStyle=mark.fill;ctx.fillRect(layout.x,layout.y,layout.width,layout.height);ctx.fillStyle=mark.color||'#000000';}
    for(const line of layout.lines){
     ctx.fillText(line.text,line.x,line.y);
     if(mark.underline||mark.strike){ctx.lineWidth=Math.max(.75,layout.size/16);ctx.beginPath();if(mark.underline){const y=line.y+layout.size*1.05;ctx.moveTo(line.x,y);ctx.lineTo(line.x+line.textWidth,y);}if(mark.strike){const y=line.y+layout.size*.55;ctx.moveTo(line.x,y);ctx.lineTo(line.x+line.textWidth,y);}ctx.stroke();}
    }
   }else if(mark.kind==='draw'){
    if(mark.points?.length){ctx.beginPath();mark.points.forEach(([x,y],i)=>i?ctx.lineTo(x*width,y*height):ctx.moveTo(x*width,y*height));if(mark.points.length===1)ctx.lineTo(mark.points[0][0]*width+.1,mark.points[0][1]*height+.1);ctx.stroke();}
   }else if(mark.kind==='line'){
    ctx.beginPath();ctx.moveTo(mark.x*width,mark.y*height);ctx.lineTo(mark.x2*width,mark.y2*height);ctx.stroke();
   }else if(['rectangle','ellipse'].includes(mark.kind)){
    const x=Math.min(mark.x,mark.x2)*width,y=Math.min(mark.y,mark.y2)*height,w=Math.abs(mark.x2-mark.x)*width,h=Math.abs(mark.y2-mark.y)*height;
    ctx.beginPath();if(mark.kind==='ellipse')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else ctx.rect(x,y,w,h);
    if(visibleFill(mark.fill)){ctx.fillStyle=mark.fill;ctx.fill();}ctx.stroke();
   }else if(mark.kind==='highlight'||mark.kind==='whiteout'){
    ctx.globalAlpha=mark.kind==='highlight'?clamp(finite(mark.opacity,.3),0,1):1;ctx.fillStyle=mark.kind==='whiteout'?'#ffffff':mark.color||'#ffff00';
    ctx.fillRect(Math.min(mark.x,mark.x2)*width,Math.min(mark.y,mark.y2)*height,Math.abs(mark.x2-mark.x)*width,Math.abs(mark.y2-mark.y)*height);
   }
  }finally{ctx.restore();}
 }
}
