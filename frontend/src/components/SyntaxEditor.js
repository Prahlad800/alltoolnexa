'use client';
import {useEffect,useRef,useState} from 'react';
import {MAX_SOURCE} from '../../shared/code-playground.mjs';

export default function SyntaxEditor({value,onChange,language}){
 const host=useRef(null),view=useRef(null),change=useRef(onChange),initial=useRef(value);
 const [ready,setReady]=useState(false);
 useEffect(()=>{change.current=onChange;initial.current=value;});
 useEffect(()=>{
  let active=true,editor;
  Promise.all([import('codemirror'),import('@codemirror/state'),import('@codemirror/view'),import('@codemirror/commands'),import('@codemirror/theme-one-dark'),import('@codemirror/lang-html'),import('@codemirror/lang-css'),import('@codemirror/lang-javascript'),import('@codemirror/lang-cpp'),import('@codemirror/lang-python')]).then(([{basicSetup},{EditorState},{EditorView,keymap},{indentWithTab},{oneDark},{html},{css},{javascript},{cpp},{python}])=>{
   if(!active)return;
   const syntax={html:html,css:css,webjs:javascript,javascript:javascript,c:cpp,cpp:cpp,python:python}[language]();
   editor=new EditorView({parent:host.current,state:EditorState.create({doc:initial.current,extensions:[basicSetup,syntax,oneDark,keymap.of([indentWithTab]),EditorState.tabSize.of(2),EditorState.changeFilter.of(transaction=>transaction.newDoc.length<=MAX_SOURCE),EditorView.contentAttributes.of({'aria-label':'Source code',spellcheck:'false',autocapitalize:'off',autocorrect:'off'}),EditorView.theme({'&':{height:'100%'},'.cm-scroller':{overflow:'auto',fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',fontSize:'14px'},'.cm-content':{minHeight:'340px'}}),EditorView.updateListener.of(update=>{if(update.docChanged)change.current(update.state.doc.toString());})]})});
   view.current=editor;setReady(true);
  }).catch(()=>{if(active)setReady(false);});
  return()=>{active=false;editor?.destroy();view.current=null;};
 },[language]);
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 return <div style={{height:'100%',minHeight:340}}><div ref={host} style={{height:'100%'}}/>{!ready&&<textarea aria-label="Source code" value={value} onChange={e=>onChange(e.target.value)} maxLength={MAX_SOURCE} spellCheck={false} autoCapitalize="off" style={{width:'100%',minHeight:340,fontFamily:'monospace',background:'#161b28',color:'#e8e8f2',padding:20,border:0}}/>}</div>;
}
