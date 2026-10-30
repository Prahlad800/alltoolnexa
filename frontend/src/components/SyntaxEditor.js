'use client';
import {useEffect,useImperativeHandle,useRef,useState} from 'react';
import {MAX_SOURCE} from '../../shared/code-playground.mjs';
import {studioLanguage} from '../../shared/code-studio-languages.mjs';

export default function SyntaxEditor({value,onChange,language,onCursorChange,readOnly=false,wordWrap=false,maxLength=MAX_SOURCE,ref}){
 const host=useRef(null),view=useRef(null),change=useRef(onChange),initial=useRef(value),cursor=useRef(onCursorChange),commands=useRef(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{change.current=onChange;initial.current=value;cursor.current=onCursorChange;});
 useImperativeHandle(ref,()=>({search:()=>commands.current?.search(view.current),focus:()=>view.current?.focus()}),[]);
 useEffect(()=>{
  let active=true,editor;
  Promise.all([import('codemirror'),import('@codemirror/state'),import('@codemirror/view'),import('@codemirror/commands'),import('@codemirror/theme-one-dark'),import('@codemirror/language'),import('@codemirror/language-data'),import('@codemirror/search')]).then(async([{basicSetup},{EditorState},{EditorView,keymap},{indentWithTab},{oneDark},{LanguageDescription,StreamLanguage},{languages},{openSearchPanel}])=>{
   const name=studioLanguage(language)?.syntax||({webjs:'JavaScript'}[language])||'text';
   const definition=LanguageDescription.matchLanguageName(languages,name,false);
   const syntax=definition?await definition.load():name==='text'?[]:StreamLanguage.define({
    startState:()=>({comment:false}),
    token(stream,state){
     if(state.comment){if(stream.match(/^.*?\*\//))state.comment=false;else stream.skipToEnd();return 'comment';}
     if(stream.eatSpace())return null;
     if(stream.match(/(?:\/\/|--|#).*/))return 'comment';
     if(stream.match('/*')){state.comment=true;return 'comment';}
     if(stream.match(/"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?/))return 'string';
     if(stream.match(/\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/i))return 'number';
     if(stream.match(/\b(?:fn|fun|function|def|do|end|if|then|else|elsif|when|case|match|for|while|loop|return|let|var|const|pub|import|export|from|use|using|struct|enum|type|model|query|mutation|fragment|on|procedure|begin|declare|select|insert|update|delete|create|table|where|as|and|or|not)\b/i))return 'keyword';
     if(stream.match(/\b(?:true|false|null|nil|undefined|None)\b/))return 'atom';
     if(stream.match(/[A-Za-z_]\w*/))return 'variableName';
     stream.next();return null;
    },
   });
   if(!active)return;
   editor=new EditorView({parent:host.current,state:EditorState.create({doc:initial.current,extensions:[basicSetup,syntax,oneDark,keymap.of([indentWithTab]),EditorState.tabSize.of(2),EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly),...(wordWrap?[EditorView.lineWrapping]:[]),EditorState.changeFilter.of(transaction=>transaction.newDoc.length<=maxLength),EditorView.contentAttributes.of({'aria-label':'Source code',spellcheck:'false',autocapitalize:'off',autocorrect:'off'}),EditorView.theme({'&':{height:'100%'},'.cm-scroller':{overflow:'auto',fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',fontSize:'13px'},'.cm-content':{minHeight:'300px'}}),EditorView.updateListener.of(update=>{if(update.docChanged)change.current(update.state.doc.toString());if(update.selectionSet||update.docChanged){const position=update.state.selection.main.head,line=update.state.doc.lineAt(position);cursor.current?.({line:line.number,column:position-line.from+1});}})]})});
   view.current=editor;commands.current={search:openSearchPanel};setReady(true);
  }).catch(()=>{if(active)setReady(false);});
  return()=>{active=false;editor?.destroy();view.current=null;commands.current=null;};
 },[language,readOnly,wordWrap,maxLength]);
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 return <div style={{height:'100%',minHeight:300}}><div ref={host} style={{height:'100%'}}/>{!ready&&<textarea aria-label="Source code" value={value} readOnly={readOnly} onChange={e=>onChange(e.target.value)} maxLength={maxLength} spellCheck={false} autoCapitalize="off" style={{width:'100%',minHeight:300,fontFamily:'monospace',background:'#101523',color:'#e8e8f2',padding:20,border:0}}/>}</div>;
}
