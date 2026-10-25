import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tools,resolveTool,aliases,categories} from '../shared/catalog.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file=path.join(root,'shared','inventory.json');
const inventory=JSON.parse(fs.readFileSync(file,'utf8'));
const requiresService=/lookup|live|stats|availability|whois|propagation|rank estimate|percentile estimate|currency converter|ssl|website status|http header|broken link|news category|hinglish|hindi to hinglish/i;
for(const entry of inventory){const tool=resolveTool(entry.id);entry.status=tool?'implemented':requiresService.test(entry.name)?'needs-service-or-verified-data':'planned';if(tool)entry.canonical=tool.id;else delete entry.canonical;}
fs.writeFileSync(file,JSON.stringify(inventory,null,2)+'\n');
const stats={canonicalTools:tools.length,aliases:Object.keys(aliases).length,inventoryIdeas:inventory.length,coveredInventoryIdeas:inventory.filter(e=>e.status==='implemented').length,planned:inventory.filter(e=>e.status==='planned').length,needsServiceOrVerifiedData:inventory.filter(e=>e.status==='needs-service-or-verified-data').length,categories:tools.reduce((out,t)=>({...out,[t.category]:(out[t.category]||0)+1}),{})};
fs.writeFileSync(path.join(root,'shared','implementation-status.json'),JSON.stringify(stats,null,2)+'\n');
fs.writeFileSync(path.join(root,'shared','published-tools.json'),JSON.stringify(tools,null,2)+'\n');
console.log(JSON.stringify(stats,null,2));

// Publish API-owned snapshots when developing the complete three-app checkout.
const backend=path.resolve(root,'../backend');
if(fs.existsSync(backend)){const data=path.join(backend,'data');fs.mkdirSync(data,{recursive:true});fs.writeFileSync(path.join(data,'categories.json'),JSON.stringify(categories.map(({id,name})=>({id,name})),null,2)+'\n');for(const name of ['inventory.json','implementation-status.json','published-tools.json'])fs.copyFileSync(path.join(root,'shared',name),path.join(data,name));}
