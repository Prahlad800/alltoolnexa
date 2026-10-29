'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {T,useLanguage,useUI} from './LanguageProvider';
import {LANGUAGES,FREE_LANGUAGES} from '../../shared/i18n.mjs';
import {apiRequest,getSession} from '../../shared/api-client.mjs';

export default function TextTranslator(){
 const {access,checkingPlan}=useLanguage();
 const {t}=useUI();
 const [text,setText]=useState(''),[source,setSource]=useState('en'),[target,setTarget]=useState('hi');
 const [result,setResult]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;pending.current?.abort();},[]);
 function invalidate(){generation.current++;pending.current?.abort();setBusy(false);setResult('');setError('');}
 async function translate(event){
  event.preventDefault();const id=++generation.current;
  pending.current?.abort();const controller=new AbortController();pending.current=controller;
  setBusy(true);setError('');setResult('');
  try{
   const session=await getSession();
   const value=await apiRequest('/api/i18n/translate',{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]),headers:session?{'X-CSRF-Token':session.csrfToken}:{},body:JSON.stringify({text,source,target})});
   if(id===generation.current)setResult(value.translation);
  }catch(cause){if(id===generation.current&&cause.name!=='AbortError')setError(cause.name==='TimeoutError'?t('Translation timed out. Please try again.'):cause.message);}
  finally{if(id===generation.current)setBusy(false);}
 }
 const available=code=>FREE_LANGUAGES.includes(code)||access.is_premium;
 return <section className="translator-card"><form onSubmit={translate}><div className="translator-languages">{[[source,setSource,'Source language'],[target,setTarget,'Target language']].map(([value,setValue,label])=><label className="field" key={label}><span><T>{label}</T></span><select value={value} onChange={event=>{invalidate();setValue(event.target.value);}}>{LANGUAGES.map(language=><option value={language.code} key={language.code} disabled={!available(language.code)||language.code==='zh-TW'}>{language.name}{!available(language.code)?' 🔒 Premium':''}</option>)}</select></label>)}</div><label className="field"><span><T>Text to translate</T></span><textarea value={text} maxLength={2000} rows={7} required onChange={event=>{invalidate();setText(event.target.value);}} placeholder={t('Enter text to translate…')}/></label><p className="translator-note">{text.length} / 2,000 · <T>Text is sent to our backend only when you select Translate. It is not saved.</T></p><div className="translator-actions"><button className="button primary" type="submit" disabled={busy||checkingPlan||!text.trim()||!available(source)||!available(target)}><T>{busy?'Translating…':'Translate'}</T></button>{busy&&<button className="button secondary" type="button" onClick={invalidate}><T>Cancel</T></button>}</div></form>{error&&<p className="translator-error" role="alert">{error}</p>}{busy&&<p role="status"><T>Translating…</T></p>}{result&&<div className="translator-result" role="status"><h2><T>Translation</T></h2><p lang={target} dir={target==='ar'?'rtl':'auto'}>{result}</p></div>}<p className="translator-note"><T>English and Hindi are free. Other languages require Premium and an installed translation model.</T> {!access.is_premium&&<Link href="/pricing"><T>View Premium plans</T> →</Link>}</p></section>;
}
