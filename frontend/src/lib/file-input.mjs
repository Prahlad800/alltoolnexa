export const FILE_LIMITS='Up to 100 files, 50 MB each and 100 MB total.';
export function needsFile(tool){return Boolean(tool.accept)&&!tool.noFile;}
export function validateFiles(files,tool={multiple:true}){
 if(files.length>100||files.some(f=>f.size>50*1024*1024)||files.reduce((n,f)=>n+f.size,0)>100*1024*1024)throw Error(FILE_LIMITS);
 if(!tool.multiple&&files.length>1)throw Error('Choose one file for this tool.');
 const accepted=(tool.accept||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 for(const file of files){if(accepted.length&&!accepted.some(type=>type==='*/*'||(type.startsWith('.')?file.name.toLowerCase().endsWith(type):type.endsWith('/*')?file.type.startsWith(type.slice(0,-1)):file.type===type)))throw Error(`${file.name}: choose a supported file (${tool.accept}).`);}
 return files;
}
export function formatBytes(bytes){return bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(1)} MB`;}
export async function imageHeader(file){
 const bytes=new Uint8Array(await file.slice(0,1048576).arrayBuffer()),view=new DataView(bytes.buffer);
 if(bytes.length>=24&&view.getUint32(0)===0x89504e47&&view.getUint32(4)===0x0d0a1a0a)return {width:view.getUint32(16),height:view.getUint32(20)};
 if(bytes[0]===255&&bytes[1]===216){
  let pos=2;while(pos+8<bytes.length){if(bytes[pos++]!==255)continue;const marker=bytes[pos++];if(marker===0xd9||marker===0xda)break;if(marker===0xff){pos--;continue;}if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;const length=view.getUint16(pos);if(length<2)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:view.getUint16(pos+5),height:view.getUint16(pos+3)};pos+=length;
  }
 }
 if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
  const kind=String.fromCharCode(...bytes.slice(12,16));
  if(kind==='VP8X'){if(bytes[20]&2)throw Error('Animated WebP is not supported. Choose a still image.');return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};}
  if(kind==='VP8 ')return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
  if(kind==='VP8L')return {width:1+(((bytes[22]&63)<<8)|bytes[21]),height:1+(((bytes[24]&15)<<10)|(bytes[23]<<2)|(bytes[22]>>6))};
 }
 throw Error('Could not read image dimensions. Choose a valid still PNG, JPEG or WebP image.');
}
export async function checkImage(file){
 const info=await imageHeader(file),budget=globalThis.navigator?.deviceMemory<=4?12000000:24000000;
 if(!info.width||!info.height||info.width*info.height>budget||Math.max(info.width,info.height)>16000)throw Error(`Image exceeds this device's ${budget/1000000} million pixel budget or 16,000 px side limit. Resize it before opening.`);
 return info;
}
