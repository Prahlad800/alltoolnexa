'use client';
import {useEffect,useRef,useState} from 'react';
import {T} from './LanguageProvider';
import {MAX_MARKDOWN,SAMPLE_MARKDOWN,EXPORT_FORMATS,DOCUMENT_CSS,standaloneHTML,safeFileName,markdownEdit} from '../../shared/markdown-workspace.mjs';
import {cleanMarkdown,importMarkdown,exportMarkdown} from '../lib/markdown-converters.mjs';
import styles from './MarkdownStudio.module.css';
const storageKey='alltoolnexa-markdown-studio-v1';
const actions=[['heading','H2','Heading'],['bold','B','Bold'],['italic','I','Italic'],['link','↗','Insert link'],['code','</>','Inline code'],['fence','{ }','Code block'],['list','•','Bullet list'],['ordered','1.','Numbered list'],['task','☑','Task list'],['quote','❝','Quote'],['table','▦','Insert table']];
export default function MarkdownStudio(){
 const [source,setSource]=useState(SAMPLE_MARKDOWN),[name,setName]=useState('my-notes'),[format,setFormat]=useState('docx'),[panel,setPanel]=useState('editor');
 const [parsed,setParsed]=useState(null),[rendering,setRendering]=useState(true),[ready,setReady]=useState(false),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Ready to write.'),[backup,setBackup]=useState(null);
 const editor=useRef(null),input=useRef(null),preview=useRef(null),controller=useRef(null),operation=useRef(0);
 useEffect(()=>{
  let active=true;
  queueMicrotask(()=>{if(!active)return;try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){if(saved.version!==1||typeof saved.source!=='string'||saved.source.length>MAX_MARKDOWN||typeof saved.name!=='string'||saved.name.length>100||!EXPORT_FORMATS.some(([id])=>id===saved.format))throw Error();setSource(saved.source);setName(saved.name);setFormat(saved.format);}}catch{setError('The saved draft could not be restored. You can start a new document.');}setReady(true);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  const timer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:1,source,name,format}));setSaved(true);}catch{setSaved(false);setStatus('Local saving is unavailable. Download your Markdown to keep it.');}},500);
  return()=>clearTimeout(timer);
 },[source,name,format,ready]);
 useEffect(()=>{
  let active=true;
  const timer=setTimeout(async()=>{try{const result=await cleanMarkdown(source);if(active){setParsed(result);setRendering(false);}}catch(cause){if(active){setError(cause.message);setRendering(false);}}},150);
  return()=>{active=false;clearTimeout(timer);};
 },[source]);
 useEffect(()=>()=>{operation.current++;controller.current?.abort();},[]);
 function change(value){setSource(value);setSaved(false);setBackup(null);setRendering(true);setError('');}
 function replace(value,title){setBackup({source,name});setSource(value);setName(title);setSaved(false);setRendering(true);setPanel('editor');}
 function insert(action){
  const area=editor.current;if(!area||busy)return;
  try{const edit=markdownEdit(source,area.selectionStart,area.selectionEnd,action);change(edit.value);setPanel('editor');requestAnimationFrame(()=>{area.focus();area.setSelectionRange(edit.start,edit.end);});}catch(cause){setError(cause.message);}
 }
 async function open(file){
  if(!file)return;const id=++operation.current;setBusy(true);setError('');setStatus('Opening your document…');
  try{const text=await importMarkdown(file);if(id!==operation.current)return;replace(text,safeFileName(file.name));setStatus(/\.docx$/i.test(file.name)?'Word imported. Review the Markdown; advanced layouts and images are not retained.':'Document opened.');}
  catch(cause){if(id===operation.current){setError(cause.message||'The file could not be opened.');setStatus('Import failed.');}}
  finally{if(id===operation.current)setBusy(false);if(input.current)input.current.value='';}
 }
 async function download(){
  const id=++operation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setStatus('Preparing your download…');
  try{
   const blob=await exportMarkdown(source,name,format,{signal:abort.signal,onProgress:text=>{if(id===operation.current)setStatus(text);}});
   if(id!==operation.current||abort.signal.aborted)return;
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=safeFileName(name)+'.'+format;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
   setStatus('Download ready.');
  }catch(cause){if(id===operation.current){setError(cause.name==='AbortError'?'Export cancelled.':cause.message||'Export failed.');setStatus('Export stopped.');}}
  finally{if(id===operation.current)setBusy(false);}
 }
 function cancel(){operation.current++;controller.current?.abort();setBusy(false);setStatus('Export cancelled.');}
 async function print(){
  if(!source.trim()){setError('Write or import a document before printing.');return;}
  const popup=window.open('','_blank');if(!popup){setError('Allow popups to use Print / Save PDF, or choose the direct PDF download.');return;}
  popup.opener=null;setError('');
  try{const doc=await cleanMarkdown(source);popup.document.open();popup.document.write(standaloneHTML(doc.html,name));popup.document.close();popup.focus();popup.print();setStatus('Print window opened. Choose Save as PDF in your browser.');}
  catch(cause){popup.close();setError(cause.message||'Print preview could not open.');}
 }
 const stats=parsed||{words:0,characters:0,readingMinutes:0,headings:[]};
 return <section className={styles.studio} aria-label="Markdown studio"><style>{DOCUMENT_CSS}</style><header className={styles.toolbar}><label className={styles.name}><span><T>Document name</T></span><input value={name} maxLength={100} disabled={busy} onChange={event=>{setName(event.target.value);setSaved(false);}}/></label><div className={styles.fileActions}><input ref={input} hidden type="file" accept=".md,.markdown,.mdown,.txt,.html,.htm,.docx" onChange={event=>open(event.target.files?.[0])}/><button type="button" disabled={busy||!ready} onClick={()=>input.current?.click()}><T>Open file</T></button><button type="button" disabled={busy||!ready} onClick={()=>{replace('','Untitled');setStatus('New document ready.');}}><T>New document</T></button><button type="button" disabled={busy} onClick={()=>{replace(SAMPLE_MARKDOWN,'my-notes');setStatus('Sample loaded.');}}><T>Load sample</T></button></div></header>
 <div className={styles.mobileTabs} role="tablist" aria-label="Markdown panels"><button role="tab" type="button" aria-selected={panel==='editor'} onClick={()=>setPanel('editor')}><T>Editor</T></button><button role="tab" type="button" aria-selected={panel==='preview'} onClick={()=>setPanel('preview')}><T>Preview</T></button></div>
 <div className={styles.workspace} data-panel={panel}><section className={styles.editorPane} aria-label="Markdown editor panel"><div className={styles.formatbar} role="toolbar" aria-label="Markdown formatting">{actions.map(([id,symbol,label])=><button key={id} type="button" aria-label={label} title={label} disabled={busy} onMouseDown={event=>event.preventDefault()} onClick={()=>insert(id)}>{symbol}</button>)}</div><textarea ref={editor} className={styles.source} aria-label="Markdown source" value={source} maxLength={MAX_MARKDOWN} disabled={!ready||busy} spellCheck={false} autoCapitalize="off" placeholder="# Start writing…" onChange={event=>change(event.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())){event.preventDefault();insert(event.key.toLowerCase()==='b'?'bold':'italic');}}}/><div className={styles.editorStatus}><span>{source.length.toLocaleString()} / 200,000</span><span><T>{saved?'Saved on this device':'Unsaved draft'}</T></span></div></section>
 <section className={styles.previewPane} aria-label="Markdown preview panel"><div className={styles.previewHeading}><h2><T>Document preview</T></h2><span role="status"><T>{rendering?'Updating preview…':'Live preview'}</T></span></div><div className={styles.paperScroller}><article ref={preview} className="md-document" aria-label="Rendered Markdown" dangerouslySetInnerHTML={{__html:parsed?.html||''}}/>{!source.trim()&&<p className={styles.empty}><T>Your document preview will appear here.</T></p>}</div></section></div>
 <div className={styles.stats}><span>{stats.words.toLocaleString()} <T>words</T></span><span>{stats.readingMinutes} <T>min read</T></span><span>{stats.headings.length} <T>headings</T></span>{backup&&<button type="button" disabled={busy} onClick={()=>{setSource(backup.source);setName(backup.name);setBackup(null);setSaved(false);setRendering(true);setStatus('Previous document restored.');}}><T>Undo replacement</T></button>}</div>
 {stats.headings.length>0&&<details className={styles.outline}><summary><T>Document outline</T></summary><nav aria-label="Document outline">{stats.headings.map(heading=><button type="button" key={heading.id} style={{paddingInlineStart:12+(heading.depth-1)*12}} onClick={()=>{setPanel('preview');requestAnimationFrame(()=>preview.current?.querySelector('[id="'+CSS.escape(heading.id)+'"]')?.scrollIntoView({behavior:'smooth',block:'start'}));}}>{heading.text}</button>)}</nav></details>}
 <footer className={styles.exports}><div className={styles.exportRow}><label><span><T>Convert to</T></span><select aria-label="Export format" value={format} disabled={busy} onChange={event=>{setFormat(event.target.value);setSaved(false);setError('');}}>{EXPORT_FORMATS.map(([id,title])=><option value={id} key={id}>{title}</option>)}</select></label><button className={styles.primary} type="button" disabled={busy||!ready||!source.trim()} onClick={download}><T>{busy?'Working…':'Convert & download'}</T></button>{busy?<button type="button" onClick={cancel}><T>Cancel export</T></button>:<button type="button" onClick={print} disabled={!source.trim()}><T>Print / Save PDF</T></button>}</div>{format==='pdf'&&<p className={styles.pdfNote}><T>Direct PDF preserves the visual layout as images. For selectable text, use Print / Save PDF.</T></p>}<p className={styles.privacy}><b>●</b> <T>Files stay on your device. No signup required.</T></p><p className={styles.note}><T>Headings, lists, tables, links and code are supported. Images appear as descriptions; raw HTML stays inactive. Open files up to 5 MB.</T></p>{error&&<p role="alert" className={styles.error}>{error}</p>}<p role="status" className={styles.status}><T>{status}</T></p></footer></section>;
}
