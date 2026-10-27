'use client';
import {useState,useSyncExternalStore} from 'react';
const subscribe=callback=>{window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback);};
const selectedTool=()=>new URLSearchParams(window.location.search).get('tool')||'';
export default function IssueReport({initialTool=''}){
 const queryTool=useSyncExternalStore(subscribe,selectedTool,()=>initialTool);
 const[editedTool,setTool]=useState(null),[details,setDetails]=useState(''),[notice,setNotice]=useState('');
 const tool=editedTool??(queryTool||initialTool);
 function download(e){e.preventDefault();const text=`AllToolNexa issue report\nTool: ${tool}\nBrowser: ${navigator.userAgent}\n\n${details}\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='alltoolnexa-issue-report.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Report downloaded. Nothing was sent. Share the file with the website owner.');}
 return <form className="issue-form" onSubmit={download}><h2>Prepare an issue report</h2><p>This form downloads a report for you to share with the website owner. It does not submit or save it on a server.</p><label className="field">Tool name<input value={tool} onChange={e=>setTool(e.target.value)} required/></label><label className="field">Steps, expected result and actual result<textarea rows={6} value={details} onChange={e=>setDetails(e.target.value)} required/></label><button className="button primary">Download issue report</button><p role="status">{notice}</p></form>;
}
