import fs from 'node:fs';
import {tools} from '../shared/catalog.mjs';
import {premiumCatalogs} from '../shared/premium-locales.mjs';
const directory=new URL('../../backend/data/locales/',import.meta.url);
fs.mkdirSync(directory,{recursive:true});
for(const [locale,messages] of Object.entries(premiumCatalogs(tools)))fs.writeFileSync(new URL(locale+'.json',directory),JSON.stringify(messages,null,2)+'\n');
console.log('Prepared 24 local Premium UI catalogs. No translation API required.');
