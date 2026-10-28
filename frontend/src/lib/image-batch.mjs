// Decode one image at a time; all selected files continue automatically in groups of 50.
export async function processImageBatch(files,processOne,{signal,onProgress,makeZip}={}){
 if(!files.length)throw Error('Choose images first.');
 const zip=makeZip?await makeZip():new (await import('jszip')).default();
 const names=new Set(),report=[];
 for(let start=0;start<files.length;start+=50){
  for(let index=start;index<Math.min(start+50,files.length);index++){
   signal?.throwIfAborted();
   const result=await processOne(files[index],index);signal?.throwIfAborted();
   const extension=result.blob.type.split('/')[1]?.replace('jpeg','jpg')||'bin';
   const stem=files[index].name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,120)||'image';
   let name=`${stem}.${extension}`,suffix=2;while(names.has(name.toLowerCase()))name=`${stem}-${suffix++}.${extension}`;names.add(name.toLowerCase());
   zip.file(name,result.blob);report.push(`${index+1}. ${name}: ${result.blob.size} bytes`);
   onProgress?.({completed:index+1,total:files.length,batch:Math.floor(index/50)+1});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 signal?.throwIfAborted();
 const blob=await zip.generateAsync({type:'blob',compression:'STORE'});signal?.throwIfAborted();
 return {blob,filename:'alltoolnexa-resized-images.zip',text:`${files.length} images resized in ${Math.ceil(files.length/50)} batches.\n${report.join('\n')}`};
}
