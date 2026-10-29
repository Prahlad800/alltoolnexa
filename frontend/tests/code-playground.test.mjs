import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_SOURCE,DEFAULT_FILES,freshProject,restoreProject,buildPreview,readTar,fileName,sourceFile} from '../shared/code-playground.mjs';

test('saved projects round-trip independent language sources without executing them',()=>{
 const project=freshProject();project.language='python';project.files.python='print("draft")';project.stdin='42\n';
 const restored=restoreProject(JSON.stringify(project));assert.deepEqual(restored,project);assert.equal(sourceFile(restored),'python');
 assert.equal(fileName(sourceFile(restored)),'main.py');restored.files.c='changed';assert.equal(DEFAULT_FILES.c,freshProject().files.c);
});
test('corrupt, oversized and unknown saved inputs are rejected',()=>{
 for(const change of [{version:2},{language:'bash'},{webTab:'unknown'},{stdin:[]},{files:{}},{files:{...DEFAULT_FILES,python:'x'.repeat(MAX_SOURCE+1)}}])assert.throws(()=>restoreProject(JSON.stringify({...freshProject(),...change})));
 assert.throws(()=>restoreProject('not-json'));
});
test('HTML preview holds script-closing payloads as data and denies outside network access',()=>{
 const html=buildPreview({...DEFAULT_FILES,webjs:'console.log("</script><script>bad()</script>")'},7);
 assert.equal((html.match(/<script>/g)||[]).length,1);
 assert.equal((html.match(/<\/script>/g)||[]).length,1);
 assert.ok(html.includes('\\u003c/script\\u003e'));assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes("form-action 'none'"));assert.ok(html.includes("base-uri 'none'"));
 assert.ok(html.includes("script.textContent=data.js"));assert.ok(html.includes('runId:data.runId'));
});
function archive(name,content='sample',sizeOverride){
 const bytes=new Uint8Array(2048),encoder=new TextEncoder();
 bytes.set(encoder.encode(name),0);bytes.set(encoder.encode((sizeOverride??content.length).toString(8).padStart(11,'0')+'\0'),124);bytes[156]=48;bytes.set(encoder.encode(content),512);return bytes;
}
test('runtime archive files stay in the emulated filesystem with exact content',()=>{
 const fs=readTar(archive('sys/test.h','hello'));assert.deepEqual(Object.keys(fs),['/sys/test.h']);assert.equal(new TextDecoder().decode(fs['/sys/test.h'].content),'hello');assert.equal(fs['/sys/test.h'].mode,'binary');
});
test('runtime archive rejects path traversal and truncated content',()=>{
 assert.throws(()=>readTar(archive('../outside')));assert.throws(()=>readTar(archive('large','x',99999)));
});
