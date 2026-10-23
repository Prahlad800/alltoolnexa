'use client';
import {useEffect,useRef,useState} from 'react';
import {closePDF} from '../lib/pdf-lifecycle.mjs';
import {loadPDF,renderPage} from '../lib/reference-files.mjs';
import {parsePages} from '../lib/pdf-tools.mjs';

export default function PDFSettings({file,password='',mode,values,onChange,disabled}){
 const[state,setState]=useState({}),[offset,setOffset]=useState(0),container=useRef(null);
 useEffect(()=>{let active=true,pdf;const root=container.current;const controller=new AbortController();
  (async()=>{try{pdf=await loadPDF(file,password,controller.signal);if(!active){await closePDF(pdf);return;}setState({count:pdf.numPages});if(!root)return;root.replaceChildren();
   for(let n=offset+1;n<=Math.min(offset+6,pdf.numPages);n++){if(!active)break;const page=await pdf.getPage(n),viewport=page.getViewport({scale:1}),scale=Math.min(160/viewport.width,200/viewport.height),canvas=await renderPage(page,scale,controller.signal);if(!active){canvas.width=1;canvas.height=1;break;}const item=document.createElement('div'),label=document.createElement('span');label.textContent=`Page ${n}`;canvas.setAttribute('aria-label',`Preview of page ${n}`);item.append(canvas,label);root.append(item);page.cleanup();}
  }catch(e){if(active)setState({error:e.message});}})();
  return()=>{active=false;controller.abort();void closePDF(pdf).catch(()=>{});if(root){for(const c of root.querySelectorAll('canvas')){c.width=1;c.height=1;}}};
 },[file,password,offset]);
 const count=state.count||0;let selected=[],rangeError='';if(count&&['extract','remove','reorder'].includes(mode))try{selected=parsePages(values.pages,count).map(n=>n+1);}catch(e){rangeError=e.message;}
 function toggle(n){const next=selected.includes(n)?selected.filter(p=>p!==n):[...selected,n].sort((a,b)=>a-b);onChange({pages:next.join(',')});}
 function reorder(index,direction){const next=[...selected];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange({pages:next.join(',')});}
 return <section className="pdf-settings" aria-label="PDF page preview"><p role="status">{state.error|| (count?`${count} pages in ${file.name}`:'Loading PDF preview…')}</p><div ref={container} className="pdf-thumbnails"/>{count>6&&<div className="preview-pagination"><button type="button" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-6))}>Previous pages</button><span>{offset+1}–{Math.min(offset+6,count)} of {count}</span><button type="button" disabled={offset+6>=count} onClick={()=>setOffset(offset+6)}>Next pages</button></div>}
 {['extract','remove'].includes(mode)&&count>0&&<><p>{mode==='remove'?'Choose pages to remove':'Choose pages to extract into one PDF'}</p><div className="page-choices">{Array.from({length:Math.min(6,count-offset)},(_,i)=>offset+i+1).map(n=><label key={n}><input type="checkbox" checked={selected.includes(n)} disabled={disabled} onChange={()=>toggle(n)}/>Page {n}</label>)}</div><p aria-live="polite">{selected.length} selected{mode==='remove'?` · ${count-selected.length} remaining`:''}</p></>}
 {mode==='reorder'&&count>0&&<><p>Page order (numeric range input below also supports every page).</p><ol className="ordered-files">{selected.slice(offset,offset+6).map((n,i)=><li key={n}><span>Page {n}</span><button type="button" aria-label={`Move page ${n} up`} disabled={disabled||offset+i===0} onClick={()=>reorder(offset+i,-1)}>↑</button><button type="button" aria-label={`Move page ${n} down`} disabled={disabled||offset+i===selected.length-1} onClick={()=>reorder(offset+i,1)}>↓</button></li>)}</ol></>}
 {rangeError&&<p className="hint">{rangeError}</p>}
 </section>;
}
