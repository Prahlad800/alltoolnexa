'use client';
import {useEffect,useRef,useState} from 'react';
import {T} from './LanguageProvider';
import SyntaxEditor from './SyntaxEditor';
import {LANGUAGES,MAX_STDIN,MAX_OUTPUT,DEFAULT_FILES,freshProject,restoreProject,sourceFile,fileName,buildPreview} from '../../shared/code-playground.mjs';
import {RUNTIME_BASE} from '../../shared/code-runtime-manifest.mjs';
import styles from './CodePlayground.module.css';

const storageKey='alltoolnexa-code-studio-v1';
export default function CodePlayground(){
 const [project,setProject]=useState(freshProject),[ready,setReady]=useState(false),[saved,setSaved]=useState(false),[storageError,setStorageError]=useState('');
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('Ready when you are.'),[output,setOutput]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(null),[panel,setPanel]=useState('editor'),[stale,setStale]=useState(false),[downloading,setDownloading]=useState(false);
 const worker=useRef(null),timeout=useRef(null),generation=useRef(0),frame=useRef(null);
 const key=sourceFile(project),language=LANGUAGES.find(item=>item.id===project.language);
 useEffect(()=>{
  let active=true;
  queueMicrotask(()=>{if(!active)return;try{const stored=localStorage.getItem(storageKey);if(stored)setProject(restoreProject(stored));}catch{setStorageError('Could not restore your saved draft. Download your work to keep a backup.');}setReady(true);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  const timer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(project));setSaved(true);setStorageError('');}catch{setStorageError('Draft could not be saved on this device. Download your work to keep it.');setSaved(false);}},500);
  return()=>clearTimeout(timer);
 },[project,ready]);
 useEffect(()=>()=>{generation.current++;worker.current?.terminate();clearTimeout(timeout.current);},[]);
 useEffect(()=>{
  const message=event=>{
   const data=event.data;
   if(event.origin!=='null'||event.source!==frame.current?.contentWindow||!data||data.source!=='alltoolnexa-preview'||data.runId!==generation.current||typeof data.text!=='string')return;
   if(data.kind==='ready'){setStatus('Preview ready.');return;}
   if(['log','warn','error'].includes(data.kind))setOutput(previous=>(previous+(data.kind==='log'?'':data.kind.toUpperCase()+': ')+data.text.slice(0,10000)+'\n').slice(0,MAX_OUTPUT));
  };
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[]);
 function update(values){setProject(previous=>({...previous,...values}));setSaved(false);setStale(true);}
 function stop(text='Stopped.'){
  generation.current++;worker.current?.terminate();worker.current=null;clearTimeout(timeout.current);setBusy(false);setPreview(null);setStatus(text);
 }
 function chooseLanguage(value){stop('Ready when you are.');update({language:value});setOutput('');setError('');setStale(false);setPanel('editor');}
 function run(){
  stop();const id=++generation.current;setOutput('');setError('');setStale(false);setPanel('output');
  if(project.language==='web'){setPreview({html:buildPreview(project.files,id),id});setStatus('Starting preview…');return;}
  if(typeof WebAssembly==='undefined'||typeof Worker==='undefined'){setError('Your browser does not support this code runner. Try an up-to-date browser.');return;}
  setBusy(true);setStatus('Loading browser runtime…');
  try{
   const instance=new Worker(`${RUNTIME_BASE}/runner.js`,{type:'module'});worker.current=instance;
   const finish=()=>{clearTimeout(timeout.current);instance.terminate();if(worker.current===instance)worker.current=null;setBusy(false);};
   instance.onmessage=({data})=>{
    if(id!==generation.current)return;
    if(data.type==='status')setStatus(data.text);
    if(data.type==='output')setOutput(previous=>(previous+data.text).slice(0,MAX_OUTPUT));
    if(data.type==='done'){finish();setStatus(data.exitCode===0?'Finished · exit code 0':'Finished · exit code '+data.exitCode);}
    if(data.type==='error'){finish();setError(data.message);setStatus('Run failed.');}
   };
   instance.onerror=()=>{if(id!==generation.current)return;finish();setError('The code runner could not start. Reload and try again.');setStatus('Run failed.');};
   timeout.current=setTimeout(()=>{if(id!==generation.current)return;stop('Time limit reached.');setError('Stopped after 60 seconds. Check for an infinite loop or try again after the runtime downloads.');},60000);
   instance.postMessage({language:project.language,code:project.files[key],stdin:project.stdin});
  }catch{setBusy(false);setError('The code runner could not start in this browser.');setStatus('Run failed.');}
 }
 async function download(){
  setDownloading(true);setError('');
  try{
   let blob,name;
   if(project.language==='web'){
    const {default:JSZip}=await import('jszip');const zip=new JSZip();
    zip.file('index.html','<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<link rel="stylesheet" href="style.css">\n'+project.files.html+'\n<script src="script.js"></script>');
    zip.file('style.css',project.files.css);zip.file('script.js',project.files.webjs);blob=await zip.generateAsync({type:'blob'});name='alltoolnexa-web-project.zip';
   }else{blob=new Blob([project.files[key]],{type:'text/plain;charset=utf-8'});name=fileName(key);}
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch{setError('Download failed. Try again.');}finally{setDownloading(false);}
 }
 return <section className={styles.studio} aria-label="Code studio"><header className={styles.toolbar}><label className={styles.language}><span><T>Language</T></span><select value={project.language} onChange={event=>chooseLanguage(event.target.value)} disabled={!ready}>{LANGUAGES.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label><div className={styles.actions}><button type="button" className={styles.run} onClick={run} disabled={!ready||busy}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 2 9 6-9 6z" fill="currentColor"/></svg><T>Run</T></button><button type="button" onClick={()=>stop()} disabled={!busy&&!preview}><T>Stop</T></button><button type="button" onClick={download} disabled={!ready||downloading}><T>{project.language==='web'?'Download project':'Download source'}</T></button></div></header>
 <div className={styles.mobileTabs} role="tablist" aria-label="Workspace panels"><button role="tab" type="button" aria-selected={panel==='editor'} onClick={()=>setPanel('editor')}><T>Editor</T></button><button role="tab" type="button" aria-selected={panel==='output'} onClick={()=>setPanel('output')}><T>{project.language==='web'?'Preview & console':'Output'}</T>{busy&&<span className={styles.dot}/>}</button></div>
 <div className={styles.workspace} data-panel={panel}><section className={styles.editorPane} aria-label="Editor panel"><div className={styles.filebar}>{project.language==='web'?<div className={styles.fileTabs} role="tablist" aria-label="Project files">{['html','css','webjs'].map(file=><button key={file} type="button" role="tab" aria-selected={key===file} onClick={()=>{setProject(previous=>({...previous,webTab:file}));setSaved(false);}}>{fileName(file)}</button>)}</div>:<span className={styles.filename}>{fileName(key)}</span>}<button type="button" className={styles.reset} onClick={()=>update({files:{...project.files,[key]:DEFAULT_FILES[key]}})}><T>Reset file</T></button></div><div className={styles.code}><SyntaxEditor value={project.files[key]} language={key} onChange={value=>update({files:{...project.files,[key]:value}})}/></div><div className={styles.editorFooter}><span>{project.files[key].split('\n').length} <T>lines</T></span><span>{saved?'Saved on this device':'Unsaved draft'}</span></div>{project.language!=='web'&&<label className={styles.stdin}><span><T>Standard input</T> <small>(stdin)</small></span><textarea rows={3} value={project.stdin} maxLength={MAX_STDIN} placeholder="Input for scanf, cin or input() — add a newline after each value." onChange={event=>update({stdin:event.target.value})}/></label>}</section>
 <section className={styles.outputPane} aria-label="Output panel"><div className={styles.outputHeading}><h2><T>{project.language==='web'?'Preview':'Console output'}</T></h2><span className={styles.runtimeBadge}>{project.language==='web'?'LIVE PREVIEW':language.label+' · BROWSER'}</span></div>{project.language==='web'&&(preview?<iframe key={preview.id} ref={frame} title="Website preview" className={styles.preview} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview.html}/>:<div className={styles.empty}><span aria-hidden="true">&lt;/&gt;</span><h3><T>Your next idea starts here.</T></h3><p><T>Press Run to preview your website.</T></p></div>)}<div className={styles.consoleHeading}><span><T>Console</T></span><button type="button" onClick={()=>setOutput('')}><T>Clear</T></button></div><pre className={styles.console} aria-label="Program output" tabIndex={0}>{output||(busy?'Running…':'Output will appear here.')}</pre>{error&&<p className={styles.error} role="alert">{error}</p>}<div className={styles.runStatus} role="status">{busy&&<span className={styles.dot}/>}<T>{status}</T>{stale&&<small><T>Edited since last run</T></small>}</div></section></div>
 <footer className={styles.notes}><span><b>●</b> <T>Free · No signup · Runs on your device</T></span>{project.language==='javascript'&&<p><T>JavaScript console uses QuickJS. Choose HTML / CSS / JS for DOM and browser APIs.</T></p>}<p>{project.language==='web'?<T>HTML, CSS and JavaScript preview in an isolated frame. Your code stays in your browser.</T>:<T>Standard libraries only. The runtime downloads on your first run; C/C++ needs about 19 MB, Python about 14 MB. Programs stop after 60 seconds.</T>}</p>{storageError&&<p role="alert" className={styles.storageError}>{storageError}</p>}</footer></section>;
}
