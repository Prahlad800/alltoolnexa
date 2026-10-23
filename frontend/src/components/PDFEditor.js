'use client';
import {useEffect,useRef,useState} from 'react';
import {loadPDF} from '../lib/reference-files.mjs';
import {closePDF} from '../lib/pdf-lifecycle.mjs';
import {exportPDFEdits,paintAnnotations} from '../lib/pdf-editor.mjs';
import {validateFiles} from '../lib/file-input.mjs';
import styles from './PDFEditor.module.css';

export default function PDFEditor(){
 const [session,setSession]=useState(null),[pages,setPages]=useState([]),[selected,setSelected]=useState(0),[mode,setMode]=useState('text'),[text,setText]=useState('Your text'),[color,setColor]=useState('#d92323'),[size,setSize]=useState(18),[view,setView]=useState(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Choose a PDF to start.'),[history,setHistory]=useState([]),[position,setPosition]=useState({x:10,y:10});
 const base=useRef(null),overlay=useRef(null),pdfRef=useRef(null),generation=useRef(0),gesture=useRef(null),downloadURL=useRef(null);
 const current=pages.find(p=>p.sourceIndex===selected),index=pages.indexOf(current),marks=current?.annotations,rotation=current?.rotation;
 useEffect(()=>()=>{generation.current++;void closePDF(pdfRef.current).catch(()=>{});if(downloadURL.current)URL.revokeObjectURL(downloadURL.current);},[]);
 useEffect(()=>{
  if(!session||rotation===undefined)return;
  let active=true,task;
  (async()=>{try{
   await Promise.resolve();if(!active)return;setReady(false);setError('');
   const page=await session.pdf.getPage(selected+1);if(!active)return;
   const original=page.getViewport({scale:1,rotation:page.rotate+rotation}),scale=Math.min(1.5,1200/original.width,12000/original.height,Math.sqrt(12000000/(original.width*original.height))),viewport=page.getViewport({scale,rotation:page.rotate+rotation});
   const canvas=base.current;if(!canvas||!active)return;canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   task=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'});await task.promise;
   if(active){setView({width:canvas.width,height:canvas.height,pointsWidth:original.width});setReady(true);setStatus('Page ready. Choose a tool and click or drag on the page.');}
  }catch(e){if(active){setError(e.message);setStatus('Preview could not be loaded.');}}})();
  return()=>{active=false;task?.cancel();};
 },[session,selected,rotation]);
 useEffect(()=>{const canvas=overlay.current;if(!canvas||!view)return;canvas.width=view.width;canvas.height=view.height;paintAnnotations(canvas.getContext('2d'),marks||[],view.width,view.height);},[marks,view]);
 useEffect(()=>{if(!history.length)return;const warn=e=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[history.length]);
 async function choose(file){
  if(!file)return;if(history.length&&!window.confirm('Replace this PDF? Download your edited PDF first if you want to keep the changes.'))return;const id=++generation.current;setBusy(true);setError('');setStatus('Opening PDF…');
  try{
   validateFiles([file],{accept:'.pdf,application/pdf',multiple:false});
   const bytes=new Uint8Array(await file.arrayBuffer());
   const {PDFDocument}=await import('pdf-lib');await PDFDocument.load(bytes,{updateMetadata:false});
   const pdf=await loadPDF(file);if(id!==generation.current){await closePDF(pdf);return;}
   await closePDF(pdfRef.current);pdfRef.current=pdf;setSession({file,pdf,bytes});setPages(Array.from({length:pdf.numPages},(_,sourceIndex)=>({sourceIndex,rotation:0,annotations:[]})));setSelected(0);setHistory([]);setView(null);setReady(false);setStatus(`${pdf.numPages} pages opened locally.`);
  }catch(e){if(id===generation.current)setError('Could not open this PDF. Choose a valid unlocked PDF. '+e.message);}
  finally{if(id===generation.current)setBusy(false);}
 }
 function commit(next){setHistory(old=>[...old.slice(-29),pages]);setPages(next);setError('');setStatus('Edit added. Download the PDF to save it.');}
 function add(mark){if(!current)return;commit(pages.map(p=>p===current?{...p,annotations:[...p.annotations,mark]}:p));}
 function undo(){if(!history.length||busy)return;const previous=history.at(-1);setPages(previous);setHistory(history.slice(0,-1));if(!previous.some(p=>p.sourceIndex===selected))setSelected(previous[0].sourceIndex);setStatus('Last edit undone.');}
 function point(e){const rect=overlay.current.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))];}
 function textMark(x,y){if(!text.trim()){setError('Enter text before placing it.');return null;}return {kind:'text',x,y,text,color,size:size/view.pointsWidth};}
 function down(e){
  if(!ready||busy||e.button!==0)return;const [x,y]=point(e);e.currentTarget.setPointerCapture(e.pointerId);
  if(mode==='text'){const mark=textMark(x,y);if(mark)add(mark);return;}
  gesture.current={kind:mode,x,y,x2:x,y2:y,points:[[x,y]],color,size:Math.max(1,size/6)/view.pointsWidth};
 }
 function move(e){const mark=gesture.current;if(!mark)return;const [x,y]=point(e);if(mark.kind==='draw')mark.points.push([x,y]);else{mark.x2=x;mark.y2=y;}paintAnnotations(overlay.current.getContext('2d'),[...current.annotations,mark],view.width,view.height);}
 function up(){if(!gesture.current)return;const mark=gesture.current;gesture.current=null;add(mark);}
 function rotate(){if(current.annotations.length){setError('Clear annotations on this page before rotating it.');return;}commit(pages.map(p=>p===current?{...p,rotation:(p.rotation+90)%360}:p));}
 function reorder(direction){const next=[...pages];[next[index],next[index+direction]]=[next[index+direction],next[index]];commit(next);}
 function remove(){if(pages.length===1)return;const next=pages.filter(p=>p!==current);commit(next);setSelected(next[Math.min(index,next.length-1)].sourceIndex);}
 async function save(){
  if(!session||busy)return;const id=generation.current;setBusy(true);setError('');setStatus('Preparing edited PDF…');
  try{
   await document.fonts.ready;
   const plans=[];
   for(const entry of pages){
    const plan={sourceIndex:entry.sourceIndex,rotation:entry.rotation};
    if(entry.annotations.length){
     const page=await session.pdf.getPage(entry.sourceIndex+1),viewport=page.getViewport({scale:1,rotation:page.rotate+entry.rotation}),scale=Math.min(2,12000/viewport.width,12000/viewport.height,Math.sqrt(12000000/(viewport.width*viewport.height))),canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width*scale);canvas.height=Math.ceil(viewport.height*scale);
     try{paintAnnotations(canvas.getContext('2d'),entry.annotations,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not render annotations.');plan.overlayPng=new Uint8Array(await blob.arrayBuffer());}finally{canvas.width=1;canvas.height=1;}
    }
    plans.push(plan);
   }
   const bytes=await exportPDFEdits(session.bytes,plans);if(id!==generation.current)return;
   if(downloadURL.current)URL.revokeObjectURL(downloadURL.current);downloadURL.current=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
   const a=document.createElement('a');a.href=downloadURL.current;a.download=session.file.name.replace(/\.pdf$/i,'')+'-edited.pdf';a.click();setStatus(`Edited PDF downloaded: ${pages.length} pages. Original file unchanged.`);
  }catch(e){if(id===generation.current)setError(e.message);}finally{if(id===generation.current)setBusy(false);}
 }
 return <section className={styles.editor} aria-label="PDF editor" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();undo();}}}>
  <label className={styles.file}>Open a local PDF<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{void choose(e.target.files[0]);e.target.value='';}}/></label>
  <p className={styles.hint}>One unlocked PDF, up to 50 MB. Files stay in this browser. Original text and graphics are preserved; additions are image overlays.</p>
  <p className={styles.warning}>White cover only hides content visually. It is not secure redaction: original text can still be extracted. This editor adds content; it does not rewrite existing PDF text or perform OCR.</p>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <p className={styles.status} role="status">{status}</p>
  {session&&<>
   <div className={styles.toolbar} role="group" aria-label="Annotation tools">{[['text','Add text'],['highlight','Highlight'],['whiteout','White cover'],['draw','Draw']].map(([id,label])=><button type="button" key={id} aria-pressed={mode===id} disabled={busy} onClick={()=>setMode(id)}>{label}</button>)}<label>Color<input type="color" value={color} disabled={busy} onChange={e=>setColor(e.target.value)}/></label><label>Text size<input type="number" min="6" max="120" value={size} disabled={busy} onChange={e=>setSize(Math.max(6,Math.min(120,Number(e.target.value)||6)))}/></label></div>
   {mode==='text'&&<><label className={styles.text}>Text to add<textarea value={text} maxLength={5000} disabled={busy} onChange={e=>setText(e.target.value)}/></label><div className={styles.coordinates}><span>Keyboard placement:</span><label>X % <input type="number" min="0" max="95" value={position.x} disabled={busy} onChange={e=>setPosition({...position,x:Math.max(0,Math.min(95,Number(e.target.value)||0))})}/></label><label>Y % <input type="number" min="0" max="95" value={position.y} disabled={busy} onChange={e=>setPosition({...position,y:Math.max(0,Math.min(95,Number(e.target.value)||0))})}/></label><button type="button" disabled={!ready||busy} onClick={()=>{const mark=textMark(position.x/100,position.y/100);if(mark)add(mark);}}>Place text</button></div></>}
   <div className={styles.toolbar}><button type="button" disabled={!history.length||busy} onClick={undo}>Undo (Ctrl+Z)</button><button type="button" disabled={busy||!current?.annotations.length} onClick={()=>commit(pages.map(p=>p===current?{...p,annotations:[]}:p))}>Clear page annotations</button><button type="button" className={styles.download} disabled={busy||!ready} onClick={save}>Download edited PDF</button></div>
   <div className={styles.workspace}><nav className={styles.pages} aria-label="PDF pages">{pages.map((p,i)=><button type="button" key={p.sourceIndex} aria-pressed={p.sourceIndex===selected} disabled={busy} onClick={()=>setSelected(p.sourceIndex)}>Page {i+1} · original {p.sourceIndex+1}{p.annotations.length?' · edited':''}</button>)}</nav><div><div className={styles.toolbar}><button type="button" disabled={busy||index<1} onClick={()=>reorder(-1)}>Move earlier</button><button type="button" disabled={busy||index===pages.length-1} onClick={()=>reorder(1)}>Move later</button><button type="button" disabled={busy||!ready||Boolean(current?.annotations.length)} title="Clear this page’s annotations before rotating" onClick={rotate}>Rotate 90°</button><button type="button" disabled={busy||pages.length<2} onClick={remove}>Delete page</button></div><div className={styles.stage} aria-busy={!ready}><div className={styles.paper} style={{width:view?.width||600,aspectRatio:view?`${view.width}/${view.height}`:'1/1.414'}}><canvas ref={base} aria-label={`Original PDF page ${selected+1}`}/><canvas ref={overlay} className={styles.overlay} aria-label="Annotation area. Click to add text or drag to mark. Keyboard text placement is available above." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;if(overlay.current&&view)paintAnnotations(overlay.current.getContext('2d'),marks||[],view.width,view.height);}}/></div></div></div></div>
  </>}
 </section>;
}
