'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {apiBase} from '../../shared/api-client.mjs';

export default function VisitorTracking(){
 const path=usePathname();
 useEffect(()=>{
  if(!path)return;
  let visitId=null,active=0,lastTick=performance.now(),lastInteraction=Date.now(),closed=false;
  const post=(route,body)=>fetch(apiBase()+route,{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.ok?r.json():null).catch(()=>null);
  const interacted=()=>{lastInteraction=Date.now();};
  const tick=()=>{const now=performance.now(),elapsed=Math.min(2,(now-lastTick)/1000);if(document.visibilityState==='visible'&&document.hasFocus()&&Date.now()-lastInteraction<60000)active+=elapsed;lastTick=now;};
  const flush=()=>{tick();if(visitId)post('/api/analytics/heartbeat',{visitId,activeSeconds:Math.floor(active)});};
  // Deferring prevents Strict Mode's discarded development mount creating a visit.
  const start=setTimeout(async()=>{let referrerHost='';try{referrerHost=new URL(document.referrer).hostname;}catch{}const result=await post('/api/analytics/start',{path,referrerHost});visitId=result?.visitId||null;if(closed)flush();},120);
  const timer=setInterval(tick,1000),heartbeat=setInterval(flush,15000);
  const visibility=()=>{flush();lastTick=performance.now();};
  for(const name of ['pointerdown','pointermove','keydown','scroll'])window.addEventListener(name,interacted,{passive:true});
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',flush);
  return()=>{closed=true;clearTimeout(start);clearInterval(timer);clearInterval(heartbeat);flush();for(const name of ['pointerdown','pointermove','keydown','scroll'])window.removeEventListener(name,interacted);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',flush);};
 },[path]);
 return null;
}
