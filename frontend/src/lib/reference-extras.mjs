import {urlList} from '../../shared/reference-extras.mjs';
import {escapeHTML} from '../../shared/core.mjs';

// MD5 is kept only for compatibility with legacy checksums (RFC 1321).
export function md5(text){
 const input=new TextEncoder().encode(text),length=Math.ceil((input.length+9)/64)*64,bytes=new Uint8Array(length);bytes.set(input);bytes[input.length]=128;
 const view=new DataView(bytes.buffer);view.setUint32(length-8,(input.length*8)>>>0,true);view.setUint32(length-4,Math.floor(input.length/536870912),true);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 const shifts=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],K=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0);
 for(let offset=0;offset<length;offset+=64){let a=a0,b=b0,c=c0,d=d0;for(let i=0;i<64;i++){let f,g;if(i<16){f=(b&c)|(~b&d);g=i;}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}const x=(a+f+K[i]+view.getUint32(offset+g*4,true))>>>0,s=shifts[Math.floor(i/16)*4+i%4];a=d;d=c;c=b;b=(b+((x<<s)|(x>>>(32-s))))>>>0;}a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;}
 return [a0,b0,c0,d0].map(n=>[0,8,16,24].map(shift=>((n>>>shift)&255).toString(16).padStart(2,'0')).join('')).join('');
}
export async function processReferenceExtra(tool,v,{signal}={}){
 signal?.throwIfAborted();
 if(String(v.text||'').length>500000)throw Error('Use input below 500,000 characters.');
 if(tool.mode==='md5')return {text:md5(v.text),filename:'checksum.md5'};
 if(tool.mode==='urls'){const urls=urlList(v.text);return {text:urls.join('\n'),htmlPreview:'<h2>Your links</h2>'+urls.map(url=>'<p><a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(url)+'">'+escapeHTML(url)+'</a></p>').join(''),previewLinks:urls,filename:'urls.txt'};}
 if(tool.mode==='js'){const {minify}=await import('terser');const result=await minify(v.text,{compress:false,mangle:false,format:{comments:false}});if(result.error)throw result.error;return {text:result.code||'',filename:'minified.js'};}
 if(tool.mode==='css'){const {minify}=await import('csso');return {text:minify(v.text,{restructure:false}).css,filename:'minified.css'};}
 if(tool.mode==='html'){
  const worker=new Worker('/vendor/html-minifier.worker.js');
  let timeout,abort;
  try{return await new Promise((resolve,reject)=>{abort=()=>{worker.terminate();reject(new DOMException('Processing cancelled.','AbortError'));};signal?.addEventListener('abort',abort,{once:true});timeout=setTimeout(()=>reject(Error('Minification timed out. Try a smaller document.')),10000);worker.onmessage=event=>event.data.error?reject(Error(event.data.error)):resolve({text:event.data.text,filename:'minified.html'});worker.onerror=()=>reject(Error('Could not load the local HTML minifier. Reload the page and retry.'));worker.postMessage({text:v.text});});}finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);worker.terminate();}
 }
 throw Error('Unsupported reference utility.');
}
