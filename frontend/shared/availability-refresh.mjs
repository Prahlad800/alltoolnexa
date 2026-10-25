// Share pending requests and back off while the availability service is down.
export function createAvailabilityRefresh({request,apply,now=Date.now}){
 let pending=null,failures=0,nextAttempt=0;
 return function refresh(force=false){
  if(pending)return pending;
  if(force!==true&&now()<nextAttempt)return Promise.resolve(null);
  pending=Promise.resolve().then(request).then(value=>{
   if(!Array.isArray(value.disabledTools)||!Array.isArray(value.disabledCategories))throw Error('Invalid availability response');
   failures=0;nextAttempt=now()+5000;apply(value);return value;
  }).catch(()=>{
   failures++;nextAttempt=now()+Math.min(60000,10000*2**Math.min(failures-1,3));return null;
  }).finally(()=>{pending=null;});
  return pending;
 };
}
