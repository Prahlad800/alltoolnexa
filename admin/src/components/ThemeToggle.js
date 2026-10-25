'use client';
import {useEffect,useState} from 'react';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('alltoolnexa-theme');const value=saved?saved==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=value?'dark':'light';// eslint-disable-next-line react-hooks/set-state-in-effect
 setDark(value);}catch{}},[]);
 return <button type="button" className="theme-toggle" aria-label={dark?'Use light theme':'Use dark theme'} title={dark?'Use light theme':'Use dark theme'} aria-pressed={dark} onClick={()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('alltoolnexa-theme',next?'dark':'light');}catch{}}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>:<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>}</svg></button>;
}
