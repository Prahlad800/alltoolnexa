import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public plan snapshot matches server prices and quotas',()=>{
 const local=JSON.parse(readFileSync(new URL('../shared/plans.json',import.meta.url)));
 const server=JSON.parse(readFileSync(new URL('../../backend/data/plans.json',import.meta.url)));
 assert.deepEqual(local,server);
});
