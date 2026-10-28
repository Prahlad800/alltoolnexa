// Keep browser session cookies on the public website origin; the Flask API still validates
// the JWT, revocable session, role, Origin and CSRF token on every request.
export async function onRequest({request}) {
  const url=new URL(request.url);
  const origin=request.headers.get('Origin');
  if((origin&&origin!==url.origin)||(!['GET','HEAD'].includes(request.method)&&origin!==url.origin)) {
    return Response.json({message:'Untrusted application origin.'},{status:403});
  }
  const target=new URL('https://prahlad800.pythonanywhere.com');
  target.pathname=url.pathname;
  target.search=url.search;
  const headers=new Headers();
  for(const name of ['Accept','Accept-Language','Content-Type','Cookie','X-CSRF-Token','Origin']) {
    const value=request.headers.get(name);
    if(value)headers.set(name,value);
  }
  try {
    const upstream=await fetch(target,{
      method:request.method,headers,
      body:['GET','HEAD'].includes(request.method)?undefined:request.body,
      duplex:'half',redirect:'manual',signal:AbortSignal.timeout(20000),
    });
    if(upstream.status>=300&&upstream.status<400)throw new Error('Unexpected API redirect');
    const response=new Response(upstream.body,upstream);
    response.headers.set('Cache-Control','no-store');
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.delete('Access-Control-Allow-Origin');
    response.headers.delete('Access-Control-Allow-Credentials');
    return response;
  } catch {
    return Response.json({message:'Account service is unavailable. Please try again.'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
}
