export async function initialAvailability(){
 if(process.env.NEXT_STATIC_EXPORT==='1')return null;
 const origin=process.env.BACKEND_INTERNAL_URL||process.env.NEXT_PUBLIC_API_URL||'https://prahlad800.pythonanywhere.com';
 try{const response=await fetch(origin.replace(/\/+$/, '')+'/api/public/availability',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)return null;return await response.json();}catch{return null;}
}
