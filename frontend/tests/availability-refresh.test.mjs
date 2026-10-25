import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvailabilityRefresh} from '../shared/availability-refresh.mjs';
const state={disabledTools:['example'],disabledCategories:[]};
test('availability failures back off, preserve state and manual refresh can recover',async()=>{
 let clock=0,calls=0,stored=state,fail=true;
 const refresh=createAvailabilityRefresh({now:()=>clock,request:async()=>{calls++;if(fail)throw Error('503');return {disabledTools:[],disabledCategories:[]};},apply:v=>{stored=v;}});
 await refresh();assert.equal(calls,1);assert.equal(stored,state);
 clock=5000;await refresh();assert.equal(calls,1);
 clock=10000;await refresh();assert.equal(calls,2);
 clock=20000;await refresh();assert.equal(calls,2);
 fail=false;await refresh(true);assert.equal(calls,3);assert.deepEqual(stored.disabledTools,[]);
 clock=24000;await refresh();assert.equal(calls,3);
 clock=25000;await refresh();assert.equal(calls,4);
});
test('availability requests do not overlap and malformed responses retain known controls',async()=>{
 let complete,calls=0,applied=0;
 const refresh=createAvailabilityRefresh({request:()=>{calls++;return new Promise(resolve=>{complete=resolve;});},apply:()=>{applied++;}});
 const first=refresh();assert.equal(first,refresh(true));await Promise.resolve();assert.equal(calls,1);
 complete({success:true});await first;assert.equal(applied,0);
});
