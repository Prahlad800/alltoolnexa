import {httpURL,number} from '../../shared/core.mjs';
const phone=v=>{if(!/^\+?[1-9]\d{6,14}$/.test(v))throw Error('Use a valid international phone number.');return v;};
const email=v=>{if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('Enter a valid email format.');return v;};
const wifiEscape=s=>s.replace(/[\\;,:"']/g,c=>'\\'+c);
const vcardEscape=s=>s.replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replace(/[;,]/g,c=>'\\'+c);
export function qrPayload(mode,v){
 switch(mode){
  case 'url':return httpURL(v.url).toString();
  case 'text':if(!v.text.trim())throw Error('Enter text to encode.');return v.text;
  case 'wifi':if(!v.ssid)throw Error('Network name is required.');return `WIFI:T:${v.security};S:${wifiEscape(v.ssid)};P:${v.security==='nopass'?'':wifiEscape(v.password)};;`;
  case 'phone':return 'tel:'+phone(v.phone);
  case 'email':return `mailto:${email(v.email)}?subject=${encodeURIComponent(v.subject)}`;
  case 'whatsapp':return `https://wa.me/${phone(v.phone).replace('+','')}?text=${encodeURIComponent(v.text)}`;
  case 'sms':return `SMSTO:${phone(v.phone)}:${v.text}`;
  case 'location':return `geo:${number(v.a,'Latitude',-90,90)},${number(v.b,'Longitude',-180,180)}`;
  case 'contact':if(!v.name.trim())throw Error('Enter a name.');return `BEGIN:VCARD\nVERSION:3.0\nFN:${vcardEscape(v.name)}\nTEL:${phone(v.phone)}\nEMAIL:${email(v.email)}\nEND:VCARD`;
  default:throw Error('Unsupported QR type.');
 }
}
