let loading;
export function loadPptxBrowser(){
 if(globalThis.PptxGenJS)return Promise.resolve(globalThis.PptxGenJS);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/vendor/pptxgen.bundle.js';script.async=true;
  script.onload=()=>{if(globalThis.PptxGenJS)resolve(globalThis.PptxGenJS);else{loading=null;script.remove();reject(Error('PowerPoint library did not initialize. Reload and retry.'));}};
  script.onerror=()=>{loading=null;script.remove();reject(Error('Could not load the local PowerPoint library. Reload and retry.'));};
  document.head.append(script);
 });
 return loading;
}
