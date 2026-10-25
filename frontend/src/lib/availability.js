export async function initialAvailability(){
 const origin=process.env.BACKEND_INTERNAL_URL||process.env.NEXT_PUBLIC_API_URL||'http://127.0.0.1:5000';
 try{const response=await fetch(origin+'/api/public/availability',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)return null;return await response.json();}catch{return null;}
}
