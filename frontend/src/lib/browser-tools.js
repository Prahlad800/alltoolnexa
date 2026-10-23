import {integer,number,positive} from '../../shared/core.mjs';
import {qrPayload} from './qr-payload.mjs';
import {validateFiles,checkImage,formatBytes} from './file-input.mjs';

export function imageDataBlob(data){const m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(data.trim());if(!m)throw Error('Enter a complete PNG, JPEG or WebP Base64 data URL.');const raw=atob(m[2].replace(/\s/g,''));return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:m[1]});}
const dataURL=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read file.'));reader.readAsDataURL(file);});
function canvas(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>40000000||Math.max(w,h)>16000)throw Error('Use dimensions from 1 to 16,000 px, below 40 million pixels total.');const c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);return c;}
async function processImage(tool,v,file){
 if(!file)throw Error('Choose an image first.');
 if(tool.mode==='base64')return {text:await dataURL(file),filename:'image-base64.txt'};
 await checkImage(file);
 let image;try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('Could not decode this image. Use a valid PNG, JPEG or WebP file.');}
 const surfaces=[];const surface=(w,h)=>{const c=canvas(w,h);surfaces.push(c);return c;};
 try{
 const w=image.width,h=image.height;
 if(tool.mode==='inspect')return {text:JSON.stringify({name:file.name,width:w,height:h,bytes:file.size,type:file.type,aspectRatio:w/h},null,2)};
 if(tool.mode==='color'){const c=surface(100,100),ctx=c.getContext('2d');ctx.drawImage(image,0,0,100,100);const pixels=ctx.getImageData(0,0,100,100).data,counts=new Map();let winner='',max=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<128)continue;const key=[pixels[i],pixels[i+1],pixels[i+2]].map(x=>Math.round(x/17)*17).join(',');const count=(counts.get(key)||0)+1;counts.set(key,count);if(count>max){max=count;winner=key;}}if(!winner)throw Error('Image is entirely transparent.');return {text:'#'+winner.split(',').map(x=>Number(x).toString(16).padStart(2,'0')).join('')};}
 if(tool.mode==='pixel-color'){const x=integer(v.a,'X',0,w-1),y=integer(v.b,'Y',0,h-1),ctx=surface(1,1).getContext('2d');ctx.drawImage(image,x,y,1,1,0,0,1,1);const pixel=ctx.getImageData(0,0,1,1).data;return {text:`#${Array.from(pixel).slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('')}\nRGBA: ${Array.from(pixel).join(', ')}`};}
 let out,format=v.format||'image/png';
 if(tool.mode==='resize'){const width=integer(v.a,'Width',1,16000),height=integer(v.b,'Height',0,16000)||Math.max(1,Math.round(h*width/w));out=surface(width,height);}
 if(tool.mode==='crop'){const x=integer(v.a,'Left',0,w-1),y=integer(v.b,'Top',0,h-1),width=integer(v.c,'Width',1,w-x),height=integer(v.d,'Height',1,h-y);out=surface(width,height);}
 if(tool.mode==='square'||tool.mode==='circle')out=surface(integer(v.a,'Size',1,16000),integer(v.a,'Size',1,16000));
 if(tool.mode==='rotate'&&['90','270'].includes(v.angle))out=surface(h,w);
 if(!out)out=surface(w,h);
 const ctx=out.getContext('2d');if(!ctx)throw Error('Canvas is unavailable in this browser.');
 if(format==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);}
 if(tool.mode==='crop')ctx.drawImage(image,Number(v.a),Number(v.b),out.width,out.height,0,0,out.width,out.height);
 else if(tool.mode==='square'||tool.mode==='circle'){const size=Math.min(w,h);if(tool.mode==='circle'){ctx.beginPath();ctx.arc(out.width/2,out.height/2,out.width/2,0,Math.PI*2);ctx.clip();format='image/png';}ctx.drawImage(image,(w-size)/2,(h-size)/2,size,size,0,0,out.width,out.height);}
 else if(tool.mode==='rotate'){ctx.translate(out.width/2,out.height/2);ctx.rotate(number(v.angle,'Rotation',0,270)*Math.PI/180);ctx.drawImage(image,-w/2,-h/2);}
 else if(tool.mode==='flip'){ctx.translate(v.direction==='horizontal'?w:0,v.direction==='vertical'?h:0);ctx.scale(v.direction==='horizontal'?-1:1,v.direction==='vertical'?-1:1);ctx.drawImage(image,0,0);}
 else if(tool.mode==='pixelate'){const block=integer(v.a,'Block size',1,1000),small=surface(Math.max(1,Math.ceil(w/block)),Math.max(1,Math.ceil(h/block)));small.getContext('2d').drawImage(image,0,0,small.width,small.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,small.width,small.height,0,0,w,h);}
 else {if(tool.mode==='blur'){ctx.filter=`blur(${number(v.a,'Blur',0,100)}px)`;}ctx.drawImage(image,0,0,out.width,out.height);ctx.filter='none';if(tool.mode==='watermark'){const size=number(v.a,'Font size',8,500);ctx.font=`${size}px sans-serif`;ctx.fillStyle='rgba(255,255,255,.85)';ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=2;ctx.textAlign='right';ctx.strokeText(v.text,w-15,h-20,w-30);ctx.fillText(v.text,w-15,h-20,w-30);}}
 const quality=number(v.quality||'.9','Quality',.1,1),blob=await new Promise(resolve=>out.toBlob(resolve,format,quality));if(!blob)throw Error('The browser could not encode the image.');if(blob.type!==format)throw Error('Your browser does not support this output format. Try PNG.');
 return {blob,preview:true,filename:`${tool.id}.${format.split('/')[1].replace('jpeg','jpg')}`,warning:blob.size>=file.size?'Size did not reduce. Try WebP or lower quality, or keep your original.':'',text:`${out.width} × ${out.height} px\nOriginal: ${formatBytes(file.size)}\nOutput: ${formatBytes(blob.size)}\nOutput is ${Math.abs((1-blob.size/file.size)*100).toFixed(1)}% ${blob.size>file.size?'larger':'smaller'}.`};
 }finally{image.close();for(const c of surfaces){c.width=1;c.height=1;}}
}

export async function processBrowserTool(tool,values,files,options={}){
 options.signal?.throwIfAborted();
 validateFiles(files,tool);
 if(tool.kind==='reference-file'){const {processReferenceFile}=await import('./reference-files.mjs');return processReferenceFile(tool,values,files,options);}
 if(tool.kind==='reference-browser'){const {processReferenceBrowser}=await import('./reference-browser.mjs');return processReferenceBrowser(tool,values,files);}
 if(tool.kind==='reference-extra'){const {processReferenceExtra}=await import('./reference-extras.mjs');return processReferenceExtra(tool,values,options);}
 if(tool.kind==='screen-info')return {text:JSON.stringify({viewport:{width:innerWidth,height:innerHeight},screen:{width:screen.width,height:screen.height},devicePixelRatio},null,2)};
 if(tool.kind==='image-exif'){if(!files[0])throw Error('Choose an image.');const exifr=await import('exifr');const data=await exifr.parse(await files[0].arrayBuffer());return {text:JSON.stringify(data||{message:'No supported EXIF metadata found.'},null,2)};}
 if(tool.kind==='html-text'){const plain=values.text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'');const doc=new DOMParser().parseFromString('<!doctype html><body>'+plain.replaceAll('<','&lt;'), 'text/html');return {text:doc.body.textContent.trim()};}
 if(tool.kind==='format'){
  if(values.text.length>2000000)throw Error('Use an input below two million characters.');
  if(['yaml-json','json-yaml'].includes(tool.mode)){const YAML=await import('yaml');return {text:tool.mode==='yaml-json'?JSON.stringify(YAML.parse(values.text,{maxAliasCount:100})??null,null,2):YAML.stringify(JSON.parse(values.text)),filename:tool.mode==='yaml-json'?'converted.json':'converted.yaml'};}
  const {marked}=await import('marked'),html=await marked.parse(values.text,{async:false});
  if(tool.mode==='markdown-preview'){const importedModule=await import('dompurify'),purifier=importedModule.default;const clean=purifier.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:['img','video','audio','iframe','object','embed','form','input','meta','link','style'],FORBID_ATTR:['style']});return {text:clean,htmlPreview:clean,filename:'preview.html'};}
  return {text:html,filename:'converted.html'};
 }
 if(tool.kind==='code-format'){
  const prettier=await import('prettier/standalone');let plugins;
  if(tool.parser==='html')plugins=[await import('prettier/plugins/html')];
  else if(tool.parser==='css')plugins=[await import('prettier/plugins/postcss')];
  else plugins=[await import('prettier/plugins/babel'),await import('prettier/plugins/estree')];
  return {text:await prettier.format(values.text,{parser:tool.parser,plugins:plugins.map(m=>m.default||m),tabWidth:2}),filename:`formatted.${tool.parser==='babel'?'js':tool.parser}`};
 }
 if(tool.kind==='regex'){
  if(values.text.length>100000||values.pattern.length>10000)throw Error('Use test text below 100,000 characters and a pattern below 10,000.');
  const source=`self.onmessage=({data})=>{try{const re=new RegExp(data.pattern,data.flags),matches=[];let m;while((m=re.exec(data.text))&&matches.length<500){matches.push({index:m.index,match:m[0],groups:m.slice(1)});if(!re.global&&!re.sticky)break;if(!m[0].length)re.lastIndex++;}self.postMessage({matches,truncated:matches.length===500});}catch(e){self.postMessage({error:e.message});}}`;
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);
  let timer,abort;try{return await new Promise((resolve,reject)=>{abort=()=>{worker.terminate();reject(new DOMException('Processing cancelled.','AbortError'));};options.signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>reject(Error('Regex timed out. Simplify the pattern and try again.')),1000);worker.onmessage=e=>{if(e.data.error)reject(Error(e.data.error));else resolve({text:JSON.stringify(e.data,null,2)});};worker.onerror=()=>reject(Error('Regex worker failed.'));worker.postMessage(values);});}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.terminate();URL.revokeObjectURL(url);}
 }
 if(tool.kind==='image')return processImage(tool,values,files[0]);
 if(tool.kind==='base64-image'){const blob=imageDataBlob(values.text);if(blob.size>50*1024*1024)throw Error('Use an image below 50 MB.');const test=await createImageBitmap(blob);test.close();return {blob,preview:true,filename:`decoded.${blob.type.split('/')[1]}`};}
 if(tool.kind==='pdf'||tool.kind==='text-pdf'){const{processPDF}=await import('./pdf-tools.mjs');return processPDF(tool.kind==='text-pdf'?'text':tool.mode,values,files);}
 if(tool.kind==='file-info'){const f=files[0];if(!f)throw Error('Choose a file.');return {text:JSON.stringify({name:f.name,extension:f.name.includes('.')?f.name.split('.').pop():'none',type:f.type||'unknown',bytes:f.size},null,2)};}
 if(tool.kind==='file-hash'){if(!files[0])throw Error('Choose a file.');const hash=await crypto.subtle.digest(values.algorithm,await files[0].arrayBuffer());return {text:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};}
 if(tool.kind==='qr'){const payload=qrPayload(tool.mode,values);if(payload.length>1500)throw Error('Keep QR content below 1,500 characters.');const importedModule=await import('qrcode'),QR=importedModule.default||importedModule,url=await QR.toDataURL(payload,{width:768,margin:4,errorCorrectionLevel:'M'});return {blob:imageDataBlob(url),preview:true,text:'QR code ready. Test with a scanner before sharing.',filename:`${tool.id}.png`};}
 if(tool.kind==='barcode'){if(tool.id==='isbn-barcode-generator'&&!/^(978|979)\d{10}$/.test(values.text))throw Error('Use a 13-digit ISBN starting with 978 or 979.');const importedModule=await import('jsbarcode'),JsBarcode=importedModule.default||importedModule,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');if(values.text.length>100)throw Error('Use barcode content below 100 characters.');try{JsBarcode(svg,values.text,{format:tool.format,width:2,height:100,displayValue:true,margin:16});}catch{throw Error('Invalid content or check digit for this barcode type.');}return {blob:new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),preview:true,text:'Barcode generated. Verify the value and scan before printing.',filename:`${tool.id}.svg`};}
 throw Error('This browser operation is not implemented.');
}
