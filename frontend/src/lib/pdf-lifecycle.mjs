// PDF.js 6 releases document resources through the loading task, not the proxy.
const disposers=new WeakMap();
export async function resolvePDFTask(task,signal){
 let destruction;
 const dispose=()=>{signal?.removeEventListener('abort',abort);return destruction??=Promise.resolve().then(()=>task.destroy());};
 const abort=()=>{void dispose().catch(()=>{});};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted)abort();
  const pdf=await task.promise;
  signal?.throwIfAborted();
  disposers.set(pdf,dispose);
  return pdf;
 }catch(error){
  await dispose().catch(()=>{});
  signal?.throwIfAborted();
  throw error;
 }
}
export function closePDF(pdf){return pdf?disposers.get(pdf)?.()??Promise.resolve():Promise.resolve();}
