export async function initialAvailability(){
 const origin=process.env.BACKEND_INTERNAL_URL||process.env.NEXT_PUBLIC_API_URL||'https://prahlad800.pythonanywhere.com';
 try{const response=await fetch(origin.replace(/\/+$/, '')+'/api/public/availability',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)return null;return await response.json();}catch{return null;}
}
