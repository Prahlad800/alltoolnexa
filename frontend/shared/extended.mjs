import {number,positive,integer,sum,date,iso,DAY,slugify} from './core.mjs';

export function randomInt(min,max){const range=max-min+1;if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||range<1||range>2**32)throw Error('Use an integer range no wider than 2^32.');const limit=Math.floor(2**32/range)*range;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0];}while(x>=limit);return min+x%range;}
function shuffled(xs){const out=[...xs];for(let i=out.length-1;i>0;i--){const j=randomInt(0,i);[out[i],out[j]]=[out[j],out[i]];}return out;}

export function extendCatalog({register,field:f}) {
 const calc=register,a=(label='Value',value=100)=>f('a',label,value),b=(label='Second value',value=20)=>f('b',label,value),c=(label='Third value',value=12)=>f('c',label,value),text=(value='Hello world')=>f('text','Your text',value,'textarea');
 calc('random','Random Number Generator',[a('Minimum',1),b('Maximum',100),c('Count',5)],'Uniform integers, inclusive bounds; repeats allowed. Uses cryptographic randomness.',v=>{const min=integer(v.a,'Minimum',-1e9,1e9),max=integer(v.b,'Maximum',min,1e9);return Array.from({length:integer(v.c,'Count',1,1000)},()=>randomInt(min,max)).join(', ');});
 calc('random','UUID Generator',[a('Count',1)],'Generate RFC 4122 version 4 identifiers using cryptographic randomness.',v=>Array.from({length:integer(v.a,'Count',1,1000)},()=>crypto.randomUUID()).join('\n'));
 calc('random','Random Token Generator',[a('Random bytes',32)],'Generate random bytes as hexadecimal. Each byte becomes two hex characters.',v=>Array.from(crypto.getRandomValues(new Uint8Array(integer(v.a,'Bytes',8,256))),x=>x.toString(16).padStart(2,'0')).join(''));
 calc('random','Password Generator',[a('Length',20),f('symbols','Include symbols','yes','select',['yes','no'])],'Generate a password with uppercase, lowercase and digits, plus symbols when selected. Uses unbiased Web Crypto choices.',v=>{const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789',...(v.symbols==='yes'?['!@#$%^&*()-_=+']:[])],length=integer(v.a,'Length',8,256),alphabet=groups.join(''),out=groups.map(g=>g[randomInt(0,g.length-1)]);while(out.length<length)out.push(alphabet[randomInt(0,alphabet.length-1)]);return shuffled(out).join('');});
 calc('random','Dice Roller',[a('Dice',2),b('Sides',6)],'Roll independent fair dice with cryptographic randomness.',v=>{const rolls=Array.from({length:integer(v.a,'Dice',1,100)},()=>randomInt(1,integer(v.b,'Sides',2,1000)));return {rolls,total:sum(rolls)};});
 calc('random','Coin Flip',[a('Flips',1)],'Generate independent heads/tails outcomes with equal probability.',v=>Array.from({length:integer(v.a,'Flips',1,1000)},()=>randomInt(0,1)?'Heads':'Tails').join(', '));
 calc('random','Random Yes/No',[a('Decisions',1)],'Generate independent yes/no outcomes with equal probability.',v=>Array.from({length:integer(v.a,'Decisions',1,1000)},()=>randomInt(0,1)?'Yes':'No').join(', '));
 calc('random','Random Name Picker',[text('Asha\nRavi\nPriya\nImran'),a('Winners',1)],'Select unique line-separated entries without replacement. Duplicate names count once.',v=>{const names=[...new Set(v.text.split('\n').map(x=>x.trim()).filter(Boolean))];return shuffled(names).slice(0,integer(v.a,'Winners',1,names.length)).join('\n');});
 calc('random','Random Team Generator',[text('Asha\nRavi\nPriya\nImran\nMeera\nDev'),a('Teams',2)],'Shuffle people into balanced teams; every listed entry appears once.',v=>{const names=v.text.split('\n').map(x=>x.trim()).filter(Boolean),count=integer(v.a,'Teams',1,names.length),groups=Array.from({length:count},()=>[]);shuffled(names).forEach((name,i)=>groups[i%count].push(name));return groups.map((g,i)=>`Team ${i+1}: ${g.join(', ')}`).join('\n');});
 calc('random','Random Date',[f('start','Start date','2026-01-01','date'),f('end','End date','2026-12-31','date'),a('Count',5)],'Choose calendar dates uniformly, including both endpoints.',v=>{const start=+date(v.start),end=+date(v.end);if(end<start)throw Error('End must follow start.');return Array.from({length:integer(v.a,'Count',1,1000)},()=>iso(new Date(start+randomInt(0,(end-start)/DAY)*DAY))).join('\n');});
 calc('design','Random Color Generator',[a('Colors',5)],'Generate independent random 24-bit RGB colors.',v=>Array.from({length:integer(v.a,'Colors',1,100)},()=>'#'+randomInt(0,0xffffff).toString(16).padStart(6,'0')).join('\n'));
 for(const algorithm of ['SHA-256','SHA-384','SHA-512','SHA-1'])calc('random',`${algorithm.replace('-','')} Generator`,[text()],`Hash UTF-8 text using ${algorithm}. ${algorithm==='SHA-1'?'Legacy checksums only; SHA-1 is not suitable for security.':'A digest is not encryption or password storage.'}`,async v=>Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new TextEncoder().encode(v.text))),x=>x.toString(16).padStart(2,'0')).join(''));

 const browser=(cat,name,fields,description,kind,extra={})=>register(cat,name,fields,description,()=>{throw Error('Open this tool in the browser workbench.');},{kind,description,...extra});
 const imageBase=[f('format','Output format','image/png','select',['image/png','image/jpeg','image/webp']),f('quality','JPEG/WebP quality (0.1–1)',0.85)];
 for(const[name,mode,fields]of[
  ['Image Resize','resize',[a('Width (px)',800),b('Height (px, 0 = preserve aspect ratio)',0),...imageBase]],
  ['Image Crop','crop',[a('Left (px)',0),b('Top (px)',0),c('Width (px)',200),f('d','Height (px)',200),...imageBase]],
  ['Image Rotate','rotate',[f('angle','Clockwise degrees','90','select',['90','180','270']),...imageBase]],
  ['Image Flip','flip',[f('direction','Direction','horizontal','select',['horizontal','vertical']),...imageBase]],
  ['JPG to PNG','convert',[f('format','Output format','image/png','select',['image/png'])]],
  ['PNG to JPG','convert',[f('format','Output format','image/jpeg','select',['image/jpeg']),f('quality','Quality',0.9)]],
  ['WebP to PNG','convert',[f('format','Output format','image/png','select',['image/png'])]],
  ['PNG to WebP','convert',[f('format','Output format','image/webp','select',['image/webp']),f('quality','Quality',0.85)]],
  ['JPG to WebP','convert',[f('format','Output format','image/webp','select',['image/webp']),f('quality','Quality',0.85)]],
  ['Image Compressor','convert',[f('format','Output format','image/webp','select',['image/webp','image/jpeg']),f('quality','Quality',0.7)]],
  ['Image Dimensions Checker','inspect',[]],['Circle Image Cropper','circle',[a('Output diameter (px)',512)]],
  ['Profile Picture Cropper','square',[a('Square size (px)',512)]],['Blur Image','blur',[a('Blur radius (px)',8),...imageBase]],
  ['Pixelate Image','pixelate',[a('Block size',16),...imageBase]],
  ['Add Watermark to Image','watermark',[f('text','Watermark','AllToolNexa','text'),a('Font size (px)',32),...imageBase]],
  ['EXIF Remover','convert',imageBase],['Image to Base64','base64',[]],['Dominant Color Finder','color',[]],
 ])browser('image',name,fields,mode==='color'?'Estimate the dominant color from a sampled, quantized pixel histogram; transparent pixels are ignored.':mode==='inspect'?'Inspect dimensions, ratio, byte size and browser-reported MIME type.':mode==='base64'?'Read an image as a Base64 data URL without uploading.':'Process images locally with browser canvas. JPEG outputs use a white background. Re-encoding removes original metadata; output may be larger than the input.','image',{mode,accept:'image/jpeg,image/png,image/webp'});
 browser('image','Base64 to Image',[text('data:image/png;base64,')],'Decode a PNG/JPEG/WebP Base64 data URL into a downloadable file.','base64-image');
 for(const[name,mode,fields,multiple]of[
  ['PDF Merge','merge',[],true],['PDF Split','extract',[f('pages','Pages to extract (e.g. 1,3-5)','1','text')],false],
  ['PDF Rotate','rotate',[f('angle','Clockwise degrees','90','select',['90','180','270'])],false],
  ['PDF Reorder','reorder',[f('pages','New page order (every page once)','1','text')],false],
  ['PDF Page Counter','inspect',[],false],['PDF Metadata Viewer','metadata',[],false],['PDF Metadata Remover','clean',[],false],
  ['PDF Page Size Checker','sizes',[],false],['Add Page Numbers','numbers',[],false],
  ['Add Watermark to PDF','watermark',[f('text','Watermark text','DRAFT','text')],false],
  ['Remove Selected Pages','remove',[f('pages','Pages to remove','1','text')],false],['Images to PDF','images',[],true],
 ])browser('pdf',name,fields,'Process files on your device. Encrypted PDFs are unsupported. Re-saving does not preserve digital signatures. Original files are never modified.','pdf',{mode,multiple,accept:mode==='images'?'image/jpeg,image/png':'.pdf,application/pdf'});
 browser('pdf','Text to PDF',[text('Create a document from your text.')],'Create A4 pages with automatic wrapping. Latin text stays selectable. Hindi and other Unicode text is rendered as images using device fonts; text in that output is not selectable.','text-pdf');
 browser('random','File Hash Generator',[f('algorithm','Algorithm','SHA-256','select',['SHA-256','SHA-384','SHA-512'])],'Hash a local file with Web Crypto; files stay on your device.','file-hash',{accept:'*/*'});
 browser('developer','File Extension Finder',[],'Inspect the file name, extension, byte size and browser-reported MIME type. MIME type is advisory.','file-info',{accept:'*/*'});
 for(const[name,mode,fields]of[
  ['URL QR','url',[f('url','URL','https://example.com','text')]],['Text QR','text',[text('Hello from AllToolNexa')]],
  ['Wi-Fi QR','wifi',[f('ssid','Network name','My WiFi','text'),f('password','Network password','','password'),f('security','Security','WPA','select',['WPA','WEP','nopass'])]],
  ['Phone QR','phone',[f('phone','International number','+919876543210','text')]],
  ['Email QR','email',[f('email','Email','hello@example.com','email'),f('subject','Subject','Hello','text')]],
  ['WhatsApp QR','whatsapp',[f('phone','International digits','919876543210','text'),text('Hello')]],
  ['SMS QR','sms',[f('phone','International number','+919876543210','text'),text('Hello')]],
  ['Location QR','location',[a('Latitude',28.6139),b('Longitude',77.209)]],
  ['Contact/VCard QR','contact',[f('name','Full name','Asha Sharma','text'),f('phone','Phone','+919876543210','text'),f('email','Email','asha@example.com','email')]],
 ])browser('qr',name,fields,'Generate and download a QR code locally. Test it with your intended scanner before sharing.','qr',{mode});
 for(const[name,format,sample]of[['Barcode Generator','CODE128','TOOLNEXA123'],['EAN Generator','EAN13','5901234123457'],['UPC Generator','UPC','036000291452'],['ISBN Barcode Generator','EAN13','9780140328721']])browser('qr',name,[f('text','Barcode content',sample,'text')],'Download an SVG barcode. EAN/UPC require a valid check digit. Generating a symbol does not assign an official product identifier.','barcode',{format});
 calc('developer','Conventional Commit Generator',[f('type','Change type','feat','select',['feat','fix','docs','style','refactor','perf','test','build','ci','chore']),f('scope','Scope (optional)','tools','text'),text('add image tools')],'Create a conventional commit subject from a type, optional scope and summary.',v=>{if(!/^[a-z0-9-]*$/i.test(v.scope)||/[\r\n]/.test(v.text)||!v.text.trim())throw Error('Use a simple scope and a one-line summary.');return `${v.type}${v.scope?'('+v.scope+')':''}: ${v.text.trim()}`;});
 calc('developer','Git Branch Name Generator',[f('type','Prefix','feature','select',['feature','fix','chore','release']),text('Add new image tools')],'Create a branch path from a prefix and an ASCII slug.',v=>{const s=slugify(v.text);if(!s)throw Error('Enter an ASCII description.');return `${v.type}/${s}`;});
 calc('developer','Semantic Version Calculator',[f('text','Current version','1.2.3','text'),f('part','Bump','patch','select',['major','minor','patch'])],'Increment a stable major.minor.patch version and reset the lower components.',v=>{if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v.text))throw Error('Use a stable version such as 1.2.3.');const parts=v.text.split('.').map(Number),i=['major','minor','patch'].indexOf(v.part);parts[i]++;for(let j=i+1;j<3;j++)parts[j]=0;return parts.join('.');});
}

export const aliases={
 'days-between-dates':'date-difference-calculator','indian-age-calculator':'age-calculator','json-beautifier':'json-formatter','json-viewer':'json-formatter','api-response-formatter':'json-formatter',
 'assignment-word-counter':'word-counter','notes-word-counter':'word-counter','hindi-word-counter':'word-counter','hindi-character-counter':'character-counter','email-character-counter':'character-counter',
 'guid-generator':'uuid-generator','random-password':'password-generator','home-loan-emi':'emi-calculator','car-loan-emi':'emi-calculator','bike-loan-emi':'emi-calculator','education-loan-emi':'emi-calculator','personal-loan-emi':'emi-calculator',
 'average-marks-calculator':'average-calculator','attendance-percentage':'attendance-calculator','employee-age-calculator':'age-calculator','office-hours-calculator':'working-hours-calculator','shift-hours-calculator':'working-hours-calculator','night-shift-calculator':'working-hours-calculator',
 'working-day-calculator':'business-days-calculator','working-days-calculator':'business-days-calculator','overtime-pay':'overtime-calculator','percentage-hike':'increment-percentage-calculator','salary-increment':'salary-hike-calculator',
 'monthly-salary-to-annual-salary':'monthly-to-annual-salary','annual-salary-to-monthly':'annual-to-monthly-salary','lumpsum-calculator':'future-value-calculator','gst-calculator':'add-gst','gst-inclusive-calculator':'remove-gst','gst-exclusive-calculator':'add-gst','profit-margin-calculator':'margin-calculator',
 'break-even-units-calculator':'break-even-calculator','lead-conversion-calculator':'conversion-rate','instagram-hashtag-counter':'hashtag-counter','click-to-chat-generator':'whatsapp-link-generator','whatsapp-message-link':'whatsapp-link-generator',
 'number-to-indian-words':'rupees-to-words','indian-financial-year-finder':'financial-year-calculator','html-encoder':'html-escape-tool','jwt-payload-viewer':'jwt-decoder','epoch-converter':'unix-timestamp-converter','domain-from-url':'domain-extractor','campaign-url-builder':'utm-url-generator','utm-generator':'utm-url-generator',
 'code128-generator':'barcode-generator','jpg-to-pdf':'images-to-pdf','png-to-pdf':'images-to-pdf','extract-pdf-pages':'pdf-split','image-quality-reducer':'image-compressor','image-aspect-ratio':'image-dimensions-checker',
 'petrol-cost-calculator':'fuel-cost-calculator','trip-fuel-calculator':'fuel-cost-calculator','fuel-trip-calculator':'fuel-cost-calculator','room-area-calculator':'rectangle-area','wall-area-calculator':'rectangle-area','concrete-calculator':'concrete-volume-calculator','paint-requirement':'paint-calculator','tile-requirement':'tile-calculator','recipe-serving-converter':'recipe-scaling-calculator','billable-hours':'billable-hours-calculator',
 'random-group-generator':'random-team-generator','classroom-group-generator':'random-team-generator','git-commit-message-generator':'conventional-commit-generator','version-number-generator':'semantic-version-calculator',
};
