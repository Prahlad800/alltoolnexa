export const apiBase = () => (process.env.NEXT_PUBLIC_API_URL || 'https://prahlad800.pythonanywhere.com').replace(/\/+$/, '');
export async function apiRequest(path, options={}){
 const response=await fetch(apiBase()+path,{credentials:'include',cache:'no-store',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json().catch(()=>({message:'The backend returned an invalid response.'}));
 if(!response.ok){const error=new Error(data.message||'The request failed.');error.status=response.status;throw error;}
 return data;
}
export async function getSession(){try{return await apiRequest('/api/auth/session');}catch(error){if(error.status===401)return null;throw error;}}
