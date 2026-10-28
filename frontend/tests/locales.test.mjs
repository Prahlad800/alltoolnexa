import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGES,FREE_LANGUAGES,hindi,hindiLabel} from '../shared/i18n.mjs';
import {premiumCatalogs,messageKeys,categoryKeys} from '../shared/premium-locales.mjs';
import {tools} from '../shared/catalog.mjs';

test('English and Hindi stay free; all 24 Premium locales have matching local server catalogs',()=>{
 assert.deepEqual(FREE_LANGUAGES,['en','hi']);const catalogs=premiumCatalogs(tools);
 assert.equal(Object.keys(catalogs).length,24);
 assert.deepEqual(Object.keys(catalogs).sort(),LANGUAGES.filter(l=>!l.free).map(l=>l.code).sort());
 for(const [locale,messages] of Object.entries(catalogs)){
  assert.deepEqual(messages,JSON.parse(readFileSync(new URL('../../backend/data/locales/'+locale+'.json',import.meta.url),'utf8')));
  for(const key of [...messageKeys,...categoryKeys])assert.ok(typeof messages[key]==='string'&&messages[key].trim(),locale+': '+key);
  assert.ok(messages['PDF Merge']);assert.ok(messages['Crop PDF']);assert.ok(messages['Image Resize']);
 }
 assert.equal(LANGUAGES.find(l=>l.code==='ar').dir,'rtl');
 assert.equal(hindi['Choose your language'],'अपनी भाषा चुनें');assert.equal(hindiLabel('Crop PDF'),'क्रॉप PDF');
});
