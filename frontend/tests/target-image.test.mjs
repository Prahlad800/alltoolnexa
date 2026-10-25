import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTargetImage} from '../src/lib/target-image.mjs';
const blob=(size,type='image/jpeg')=>new Blob([new Uint8Array(size)],{type});
test('quality-only mode performs a single encode without changing its output',async()=>{
 let calls=0;const input=blob(40000);const result=await encodeTargetImage(async()=>{calls++;return input;},'image/jpeg',.7,0);
 assert.equal(calls,1);assert.equal(result.blob,input);assert.equal(result.targetBytes,null);
});
test('target caps use decimal KB and measured bytes with bounded encoding work',async()=>{
 let calls=0;const r=await encodeTargetImage(async q=>{calls++;return blob(Math.ceil(q*100000));},'image/jpeg',.9,20);
 assert.ok(r.blob.size<=20000);assert.ok(r.blob.size>19000);assert.equal(r.targetBytes,20000);assert.ok(calls<=10);
});
test('unreachable targets fail instead of returning a falsely compliant file',async()=>{
 await assert.rejects(encodeTargetImage(async()=>blob(20001),'image/jpeg',.7,20),/Cannot reach 20,000 bytes/);
});
test('invalid targets and unsupported encoders fail clearly',async()=>{
 for(const v of [-1,Infinity,'abc',50001])await assert.rejects(encodeTargetImage(async()=>blob(1),'image/jpeg',.7,v),/Target size/);
 await assert.rejects(encodeTargetImage(async()=>null,'image/jpeg',.7,20),/could not encode/);
 await assert.rejects(encodeTargetImage(async()=>blob(10,'image/png'),'image/jpeg',.7,20),/does not support/);
});
