import fs from 'node:fs';
const layout=new URL('../src/app/layout.js',import.meta.url);
let text=fs.readFileSync(layout,'utf8');
if(!text.includes('icons:{')){
 text=text.replace('export const metadata={metadataBase:',"export const metadata={icons:{icon:'/images/alltoolnexa-logo.png?v=2',shortcut:'/images/alltoolnexa-logo.png?v=2',apple:'/images/alltoolnexa-logo.png?v=2'},metadataBase:");
 fs.writeFileSync(layout,text);
}
for(const name of ['icon.png','apple-icon.png']){
 const file=new URL('../src/app/'+name,import.meta.url);
 fs.copyFileSync(new URL('../public/images/alltoolnexa-logo.png',import.meta.url),file);
 console.log(name,fs.statSync(file).size,'bytes');
}
const previous=new URL('../src/app/favicon.ico',import.meta.url);
if(fs.existsSync(previous))fs.unlinkSync(previous);
console.log('Brand favicon configured.');
