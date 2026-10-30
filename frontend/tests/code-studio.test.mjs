import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import JSZip from 'jszip';
import {STUDIO_LANGUAGES,FREE_STUDIO_LANGUAGES,hasStudioAccess,isStudioPremium} from '../shared/code-studio-languages.mjs';
import {freshProject} from '../shared/code-playground.mjs';
import {MAX_FILES,freshStudioProject,restoreStudioProject,validateStudioProject,openStudioLanguage,newStudioFile,renameStudioFile,removeStudioFile,safeStudioPath,assertImportAccess} from '../shared/code-studio-project.mjs';
import {resolveStudioImport,compileStudioModules,studioZip,importStudioFiles} from '../src/lib/code-studio-tools.mjs';

test('Phase 1 has exactly 13 free types; every requested advanced entry has a unique id',()=>{
 assert.deepEqual(FREE_STUDIO_LANGUAGES.map(item=>item.id).sort(),['html','css','javascript','jsx','typescript','tsx','python','c','cpp','java','json','markdown','text'].sort());
 assert.equal(STUDIO_LANGUAGES.length,76);assert.equal(new Set(STUDIO_LANGUAGES.map(item=>item.id)).size,76);
 for(const id of ['react','react-ts','next','vue','angular','svelte','astro','csharp','rust','zig','prisma','postgresql','mdx','notebook','log']){assert.equal(hasStudioAccess(id),false);assert.equal(hasStudioAccess(id,true),true);}
 assert.equal(isStudioPremium({is_premium:true,plan:'basic'}),false);assert.equal(isStudioPremium({is_premium:true,plan:'premium'}),true);assert.equal(isStudioPremium({is_premium:true,plan:'premium-plus'}),true);assert.equal(hasStudioAccess('unknown',true),false);
});
test('legacy drafts migrate every source and stdin without losing independent JavaScript files',()=>{
 const old=freshProject();old.language='python';old.files.python='print("my draft")';old.stdin='21\n';
 const project=restoreStudioProject(JSON.stringify(old));assert.equal(project.active,'main.py');assert.equal(project.stdin,'21\n');assert.equal(project.files.find(file=>file.path==='main.py').content,'print("my draft")');
 assert.equal(project.files.find(file=>file.path==='main.js').content,old.files.javascript);assert.equal(project.files.find(file=>file.path==='src/script.js').content,old.files.webjs);
 const roundTrip=restoreStudioProject(JSON.stringify(project));assert.deepEqual(roundTrip,project);
});
test('file creation, rename, SQL dialect preservation and deletion retain unrelated sources',()=>{
 const initial=freshStudioProject(),project=openStudioLanguage(initial,'postgresql');assert.equal(project.target,'postgresql');
 const next=renameStudioFile(project,project.active,'database/tasks.sql');assert.equal(next.files.find(file=>file.path==='database/tasks.sql').language,'postgresql');
 assert.equal(next.active,'database/tasks.sql');assert.ok(next.open.includes(next.active));assert.equal(next.files[0].content,initial.files[0].content);
 const removed=removeStudioFile(next,'database/tasks.sql');assert.equal(removed.files.length,initial.files.length);assert.ok(removed.files.some(file=>file.path===removed.active));
 assert.throws(()=>newStudioFile(initial,'index.html','html',''));assert.throws(()=>renameStudioFile(initial,'index.html','src/style.css'));
});
test('project restore rejects traversal, duplicate paths, spoofed language metadata and resource excess',()=>{
 for(const path of ['../file.py','/tmp/file.py','src/../../out.py','src\\out.py','https://bad/main.js','src//main.py','src/.git/config','alltoolnexa.studio.json'])assert.throws(()=>safeStudioPath(path));
 const project=freshStudioProject();
 for(const change of [{files:[...project.files,project.files[0]]},{files:[{path:'main.php',language:'text',content:'anything'}]},{folders:['index.html/subfolder']},{files:Array.from({length:MAX_FILES+1},(_,i)=>({path:`file${i}.txt`,language:'text',content:''}))}])assert.throws(()=>validateStudioProject({...project,...change}));
 const paid=openStudioLanguage(project,'rust');assert.throws(()=>assertImportAccess({...paid,is_premium:true},false),/requires Premium/);assert.equal(assertImportAccess(paid,true),paid);
});
test('local TypeScript imports transpile and execute; source strings never run at compile time',async()=>{
 let project=newStudioFile(freshStudioProject(),'lib/numbers.ts','typescript','export const numbers: number[] = [20, 22];');
 project=newStudioFile(project,'answer.ts','typescript',`import { numbers } from './lib/numbers'; console.log('Answer:', numbers.reduce((a,b)=>a+b,0)); console.log("require('fs') is just text");`);
 const code=await compileStudioModules(project,'answer.ts'),output=[];vm.runInNewContext(code,{console:{log:(...args)=>output.push(args.join(' '))}});assert.deepEqual(output,['Answer: 42',"require('fs') is just text"]);
 const marker='globalThis.shouldNeverExecute = true;';project=newStudioFile(project,'inert.js','javascript',marker);await compileStudioModules(project,'inert.js');assert.equal(globalThis.shouldNeverExecute,undefined);
});
test('component compilation resolves CSS/JSON and refuses outside packages, dynamic imports and locked dependencies',async()=>{
 let project=newStudioFile(freshStudioProject(),'data.json','json','{"title":"Hello"}');
 project=newStudioFile(project,'App.tsx','tsx',`import React from 'react'; import data from './data.json'; import './src/style.css'; export default function App(){return <h1>{data.title}</h1>}`);
 assert.ok((await compileStudioModules(project,'App.tsx',{component:true})).includes('createRoot'));
 assert.equal(resolveStudioImport('src/App.tsx','../data.json',project.files.map(file=>file.path)),'data.json');assert.throws(()=>resolveStudioImport('App.tsx','../../escape.js',[]),/outside/);
 for(const code of [`import fs from 'node:fs'; console.log(fs);`,`import('https://bad/module.js')`]){project={...project,files:project.files.map(file=>file.path==='App.tsx'?{...file,content:code}:file)};await assert.rejects(compileStudioModules(project,'App.tsx'));}
 project=newStudioFile(project,'paid.js','mongodb','export default 42;');project={...project,files:project.files.map(file=>file.path==='App.tsx'?{...file,content:`import answer from './paid.js'; console.log(answer)`}:file)};
 await assert.rejects(compileStudioModules(project,'App.tsx'),/Premium/);assert.ok(await compileStudioModules(project,'App.tsx',{premium:true}));
});
test('ZIP export/import preserves exact sources, empty folders, language dialects and selected file',async()=>{
 const project={...openStudioLanguage(freshStudioProject(),'mysql'),folders:['src','empty']},blob=await studioZip(project);
 const zip=new File([blob],'project.zip',{type:'application/zip'}),restored=await importStudioFiles([zip],true);
 assert.deepEqual(restored,project);await assert.rejects(importStudioFiles([zip],false),/requires Premium/);
});
test('ZIP imports reject traversal and forged free metadata atomically',async()=>{
 const zip=new JSZip();zip.file('../outside.py','print(1)');
 await assert.rejects(importStudioFiles([new File([await zip.generateAsync({type:'uint8array'})],'bad.zip')],false),/Unsafe|relative file path/);
 const paid=new JSZip();paid.file('main.rs','fn main() {}');paid.file('alltoolnexa.studio.json',JSON.stringify({version:2,name:'Bad',target:'text',active:'main.rs',open:['main.rs'],folders:[],stdin:'',files:[{path:'main.rs',language:'text'}]}));
 await assert.rejects(importStudioFiles([new File([await paid.generateAsync({type:'uint8array'})],'paid.zip')],false),/Invalid source/);
});
