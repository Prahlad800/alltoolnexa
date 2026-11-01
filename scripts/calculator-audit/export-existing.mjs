import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tools,categories,mainCategories,aliases,defaults,evaluate} from '../../frontend/shared/catalog.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'frontend/package.json')),{parse}=require('acorn');
const out=path.join(root,'reports/calculator-audit-data');
await mkdir(out,{recursive:true});
// Explicit primary-purpose classification after reviewing the registration code.
// Generic generators/validators are retained in the full inventory, not inflated
// into calculators just because their implementation uses arithmetic internally.
const wholeCategories=new Set(['math','finance','marketing','office','converters','home']);
const excluded=new Set(['roll-number-generator','study-timetable-generator','iso-date-converter']);
const extras=new Set(['financial-year-calculator','color-contrast-calculator','aspect-ratio-calculator','golden-ratio-calculator','reading-time-calculator','speaking-time-calculator','binary-to-decimal','decimal-to-binary','hex-to-decimal','decimal-to-hex','octal-to-decimal','decimal-to-octal','keyword-density-checker']);
const embedded=new Set(['spreadsheet-editor','invoice-generator']);
const sources=['catalog.mjs','extended.mjs','batch-two.mjs','reference-tools.mjs','reference-files.mjs','reference-browser.mjs','reference-extras.mjs','templates.mjs'];
const anchors=new Map(),sourceFiles=[];
for(const filename of sources){
 const file='frontend/shared/'+filename,source=await readFile(path.join(root,file),'utf8');
 sourceFiles.push({file,sha256:createHash('sha256').update(source).digest('hex')});
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='Literal'&&typeof node.value==='string'){if(!anchors.has(node.value))anchors.set(node.value,[]);anchors.get(node.value).push({file,line:node.loc.start.line});}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);};
 walk(parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true}));
}
const records=[];
for(const tool of tools){
 const calculator=tool.kind==='standard'&&!excluded.has(tool.id)&&(wholeCategories.has(tool.category)||['student','date-time'].includes(tool.category)||extras.has(tool.id));
 let sample={status:'not_applicable',inputs:null,output:null};
 if(calculator){try{const input=defaults(tool),output=await evaluate(tool.id,input);sample={status:'executed',inputs:input,output};}catch(error){sample={status:'failed',inputs:defaults(tool),output:null,error:error.message};}}
 const origin=anchors.get(tool.name)||anchors.get(tool.id)||[];
 records.push({id:tool.id,name:tool.name,slug:tool.id,path:'/tools/'+tool.id,category:tool.category,categoryName:categories.find(c=>c.id===tool.category).name,mainCategory:mainCategories.find(c=>c.children.includes(tool.category)).id,kind:tool.kind,classification:calculator?'standalone_calculator':embedded.has(tool.id)?'embedded_calculation_workspace':'other_tool',classificationBasis:calculator?'Reviewed primary numerical/calendar calculation or numerical conversion; executable registry runner.':embedded.has(tool.id)?'Contains formulas or invoice arithmetic, but is a document/workbook workflow.':'Not included in the standalone calculator census; see kind, fields and method.',description:tool.description,inputFields:tool.fields,mathematicalMethod:tool.formula,sourceLocations:origin,aliases:Object.entries(aliases).filter(([,id])=>id===tool.id).map(([alias])=>alias),defaultExecution:sample});
}
const calculators=records.filter(r=>r.classification==='standalone_calculator');
const result={schemaVersion:1,codeRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,scope:'Source registry and reviewed implementations; public production pages are not live-verified.',counts:{registeredTools:tools.length,aliases:Object.keys(aliases).length,mainCategories:mainCategories.length,subcategories:categories.length,standaloneCalculators:calculators.length,embeddedCalculationWorkspaces:records.filter(r=>r.classification==='embedded_calculation_workspace').length,defaultExecutionsPassed:calculators.filter(r=>r.defaultExecution.status==='executed').length,defaultExecutionsFailed:calculators.filter(r=>r.defaultExecution.status==='failed').length},mainCategories,categories,records};
await writeFile(path.join(out,'existing-tool-inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.counts));
for(const row of calculators.filter(r=>r.defaultExecution.status==='failed'))console.log('Default failed:',row.id,row.defaultExecution.error);
