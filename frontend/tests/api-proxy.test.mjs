import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/[[path]].js';

test('same-origin proxy forwards session and CSRF and preserves host-only cookies',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://prahlad800.pythonanywhere.com/api/auth/logout');
  assert.equal(options.headers.get('Cookie'),'alltoolnexa_user_session=test-session');
  assert.equal(options.headers.get('X-CSRF-Token'),'test-csrf');
  assert.equal(options.headers.get('Origin'),'https://alltoolnexa.pages.dev');
  return new Response('{}',{headers:{'Set-Cookie':'alltoolnexa_user_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None'}});
 };
 try{
  const response=await onRequest({request:new Request('https://alltoolnexa.pages.dev/api/auth/logout',{method:'POST',headers:{Origin:'https://alltoolnexa.pages.dev',Cookie:'alltoolnexa_user_session=test-session','X-CSRF-Token':'test-csrf'},body:'{}'})});
  assert.equal(response.status,200);
  assert.match(response.headers.get('Set-Cookie'),/HttpOnly; Secure/);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
 }finally{globalThis.fetch=original;}
});

test('cross-origin and missing-Origin mutations never reach the backend',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('must not fetch');};
 try{
  for(const origin of ['https://attacker.example',null]){
   const response=await onRequest({request:new Request('https://alltoolnexa.pages.dev/api/auth/logout',{method:'POST',headers:origin?{Origin:origin}:{}})});
   assert.equal(response.status,403);
  }
 }finally{globalThis.fetch=original;}
});

test('protected failures and backend outages stay honest',async()=>{
 const original=globalThis.fetch;
 const request=new Request('https://alltoolnexa.pages.dev/api/auth/session');
 try{
  globalThis.fetch=async()=>Response.json({message:'Please sign in.'},{status:401});
  assert.equal((await onRequest({request})).status,401);
  globalThis.fetch=async()=>{throw new Error('private upstream details');};
  const response=await onRequest({request});
  assert.equal(response.status,502);
  assert.doesNotMatch(await response.text(),/private upstream details/);
 }finally{globalThis.fetch=original;}
});
