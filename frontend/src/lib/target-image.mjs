// Keep dimensions fixed. Only return an output whose actual byte size meets the cap.
export async function encodeTargetImage(encode,format,quality,targetKB=0){
 const target=Number(targetKB);
 if(!Number.isFinite(target)||target<0||target>50000)throw Error('Target size must be between 0 and 50,000 KB.');
 const checked=async q=>{const blob=await encode(q);if(!blob)throw Error('The browser could not encode the image.');if(blob.type!==format)throw Error('Your browser does not support this output format. Try another format.');return blob;};
 const original=await checked(quality);
 if(!target)return {blob:original,quality,targetBytes:null};
 if(!['image/jpeg','image/webp'].includes(format))throw Error('Target size requires JPG or WebP.');
 const cap=Math.floor(target*1000); // KB is decimal; match the exact byte limit shown in the UI.
 if(original.size<=cap)return {blob:original,quality,targetBytes:cap};
 let low=.1,high=quality,best=await checked(low),bestQuality=low;
 if(best.size>cap)throw Error(`Cannot reach ${cap.toLocaleString('en-US')} bytes at these dimensions. Resize the image first or increase the target. Your original is unchanged.`);
 // Browser encoders need not be strictly monotonic. Every retained candidate is measured.
 for(let i=0;i<8;i++){const q=(low+high)/2,blob=await checked(q);if(blob.size<=cap){best=blob;bestQuality=q;low=q;}else high=q;}
 return {blob:best,quality:bestQuality,targetBytes:cap};
}
