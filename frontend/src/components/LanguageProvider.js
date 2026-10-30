'use client';
import {createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {createInstance} from 'i18next';
import {I18nextProvider,useTranslation} from 'react-i18next';
import {LANGUAGES,FREE_LANGUAGES,hindi,hindiLabel} from '../../shared/i18n.mjs';
import {apiRequest} from '../../shared/api-client.mjs';
import styles from './LanguageProvider.module.css';

const LanguageContext=createContext(null);
const storageKey='alltoolnexa-language';
export function useLanguage(){return useContext(LanguageContext);}
export function useUI(){const {t,i18n}=useTranslation();return {t:text=>t(String(text),{defaultValue:String(text)}),locale:i18n.language};}
export function T({children,label=false}){const {t,locale}=useUI();const text=String(children??'');return <>{locale==='hi'&&label?hindiLabel(text):t(text)}</>;}
export function LocalizedInput(props){const {t}=useUI();return <input {...props} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined}/>;}

export default function LanguageProvider({children}){
 const router=useRouter();
 const [access,setAccess]=useState({is_premium:false,allowed_languages:FREE_LANGUAGES}),[checkingPlan,setCheckingPlan]=useState(true);
 const accessGeneration=useRef(0);
 const refreshAccess=useCallback(async()=>{const id=++accessGeneration.current;setCheckingPlan(true);try{const result=await apiRequest('/api/me',{signal:AbortSignal.timeout(12000)});if(id===accessGeneration.current){setAccess(result);return result;}}catch{if(id===accessGeneration.current)setAccess({is_premium:false,allowed_languages:FREE_LANGUAGES});}finally{if(id===accessGeneration.current)setCheckingPlan(false);}},[]);
 useEffect(()=>{const timer=setTimeout(()=>void refreshAccess(),0);const refresh=()=>void refreshAccess();window.addEventListener('alltoolnexa-auth-changed',refresh);window.addEventListener('alltoolnexa-session-expired',refresh);window.addEventListener('focus',refresh);return()=>{clearTimeout(timer);window.removeEventListener('alltoolnexa-auth-changed',refresh);window.removeEventListener('alltoolnexa-session-expired',refresh);window.removeEventListener('focus',refresh);};},[refreshAccess]);
 const [i18n]=useState(()=>{const instance=createInstance();instance.init({lng:'en',fallbackLng:'en',resources:{en:{translation:{}},hi:{translation:hindi}},keySeparator:false,nsSeparator:false,initImmediate:false,interpolation:{escapeValue:false},react:{useSuspense:false}});return instance;});
 const [locale,setLocale]=useState('en'),[busy,setBusy]=useState(false),[error,setError]=useState('');const dialog=useRef(null),generation=useRef(0);
 async function select(code,{persist=true}={}){
  const language=LANGUAGES.find(l=>l.code===code);if(!language)return false;const id=++generation.current;setBusy(true);setError('');
  try{
   if(!FREE_LANGUAGES.includes(code)){const response=await apiRequest('/api/i18n/messages/'+encodeURIComponent(code),{signal:AbortSignal.timeout(12000),headers:{'Accept-Language':i18n.language}});if(id!==generation.current)return false;i18n.addResourceBundle(code,'translation',response.messages,true,true);}
   if(id!==generation.current)return false;await i18n.changeLanguage(code);setLocale(code);document.documentElement.lang=code;document.documentElement.dir=language.dir;
   if(persist)try{localStorage.setItem(storageKey,code);}catch{/* Session switching still works without browser storage. */}
   return true;
  }catch(e){if(id===generation.current)setError(e.message);return false;}finally{if(id===generation.current)setBusy(false);}
 }
 const selectRef=useRef(select);useEffect(()=>{selectRef.current=select;});

 const cancelPending=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{
  let active=true;
  const savedLocale=()=>{try{return localStorage.getItem(storageKey);}catch{return null;}};
  const restore=async()=>{
   const saved=savedLocale();
   if(!saved){if(active&&!dialog.current?.open)dialog.current?.showModal();return;}
   if(!await selectRef.current(saved,{persist:false})&&active)await selectRef.current('en');
  };
  const sync=e=>{if(e.key===storageKey)void restore();};
  const auth=()=>{const saved=savedLocale();if(saved&&!FREE_LANGUAGES.includes(saved))void restore();};
  const expired=()=>{const saved=savedLocale();if(saved&&!FREE_LANGUAGES.includes(saved))void selectRef.current('en');};
  void restore();
  window.addEventListener('storage',sync);window.addEventListener('alltoolnexa-auth-changed',auth);
  window.addEventListener('alltoolnexa-session-expired',expired);window.addEventListener('focus',auth);
  return()=>{active=false;cancelPending();window.removeEventListener('storage',sync);window.removeEventListener('alltoolnexa-auth-changed',auth);window.removeEventListener('alltoolnexa-session-expired',expired);window.removeEventListener('focus',auth);};
 },[cancelPending]);

 const value={locale,busy,error,select,access,checkingPlan,refreshAccess,open:()=>{setError('');void refreshAccess();dialog.current?.showModal();}};
 return <I18nextProvider i18n={i18n}><LanguageContext.Provider value={value}>{children}<dialog className={styles.dialog} ref={dialog} aria-labelledby="language-title" onCancel={e=>{e.preventDefault();if(!busy)void select(locale).then(ok=>{if(ok)dialog.current.close();});}}><div className={styles.heading}><span className={styles.globe} aria-hidden="true">◎</span><button type="button" aria-label="Close language selector" disabled={busy} onClick={()=>void select(locale).then(ok=>{if(ok)dialog.current.close();})}>×</button></div><h2 id="language-title"><T>Choose your language</T></h2><p><T>Select a language to get started. You can change it anytime.</T></p><div className={styles.free}>{LANGUAGES.filter(l=>l.free).map(l=><button key={l.code} lang={l.code} type="button" disabled={busy} aria-pressed={locale===l.code} onClick={()=>void select(l.code).then(ok=>{if(ok)dialog.current.close();})}><strong>{l.name}</strong><span><T>Free</T> {locale===l.code?'✓':''}</span></button>)}</div><p className={styles.note}><T>English and Hindi are free for everyone.</T></p><h3><T>More languages with Premium</T></h3>{checkingPlan&&<p role="status"><T>Checking subscription…</T></p>}<div className={styles.languages}>{LANGUAGES.filter(l=>!l.free).map(l=><button key={l.code} type="button" lang={l.code} disabled={busy||checkingPlan} aria-pressed={locale===l.code} aria-label={`${l.name}${access.is_premium?'':' — Premium, locked'}`} onClick={()=>{if(!access.is_premium){dialog.current.close();router.push('/pricing');return;}void select(l.code).then(ok=>{if(ok)dialog.current.close();});}}><span>{l.name}</span><small aria-label={access.is_premium?'Premium':'Premium locked'}>{access.is_premium?'♛':'🔒'}</small></button>)}</div>{error&&<p role="alert" className={styles.error}>{error}</p>}{busy&&<p role="status"><T>Loading…</T></p>}<Link className={styles.plans} href="/pricing" onClick={()=>dialog.current.close()}><T>View Premium plans</T> →</Link><p className={styles.note}><T>Premium languages require an active Premium or Premium Plus plan and an available translation catalog.</T></p></dialog></LanguageContext.Provider></I18nextProvider>;
}

export function LanguageSwitcher(){const language=useLanguage();return <button type="button" className={styles.switcher} onClick={language.open} aria-haspopup="dialog" aria-label="Choose language"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg><span>{LANGUAGES.find(l=>l.code===language.locale)?.name||'English'}</span></button>;}
