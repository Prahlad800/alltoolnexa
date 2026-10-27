export const apiBase = () => process.env.NEXT_PUBLIC_API_PROXY==='1'?'':(process.env.NEXT_PUBLIC_API_URL || 'https://prahlad800.pythonanywhere.com').replace(/\/+$/, '');
export async function apiRequest(path, options={}){
 const response=await fetch(apiBase()+path,{credentials:'include',cache:'no-store',...options,headers:{Accept:'application/json',...(options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json().catch(()=>({message:'The backend returned an invalid response.'}));
 if(!response.ok){if(response.status===401&&!['/api/auth/login','/api/auth/signup','/api/auth/session'].includes(path)&&typeof window!=='undefined')window.dispatchEvent(new Event('alltoolnexa-session-expired'));const error=new Error(data.message||'The request failed.');error.status=response.status;throw error;}
 return data;
}
export async function getSession(){try{return await apiRequest('/api/auth/session');}catch(error){if(error.status===401)return null;throw error;}}
