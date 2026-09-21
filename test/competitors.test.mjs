import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importCompetitor,competitorKeywords} from '../app/lib/competitors.mjs';
const page = (url='https://sweatblock.com/a') => ({url,status:200,title:'Example',extracted_keywords:[{keyword:'sweat control',count:3}]});
test('competitor import is isolated per source and replaces previous report',()=>{
  const state={};importCompetitor(state,JSON.stringify([page()]));
  importCompetitor(state,JSON.stringify([page('https://certaindri.com/b')]));
  importCompetitor(state,JSON.stringify([page('https://sweatblock.com/c')]));
  assert.equal(Object.keys(state.competitors).length,2);
  assert.equal(state.competitors['sweatblock.com'].pages[0].url,'https://sweatblock.com/c');
  assert.deepEqual(competitorKeywords(state.competitors)[0],{keyword:'sweat control',count:6,pages:2,domains:['sweatblock.com','certaindri.com']});
});
test('invalid imports never overwrite an existing report',()=>{
  const state={};importCompetitor(state,JSON.stringify([page()]));const before=JSON.stringify(state);
  for(const rows of [[page('javascript:alert(1)')],[page('https://evil.test')],[page(),page('https://certaindri.com')],[page(),page()],[{...page(),extracted_keywords:[{keyword:'bad',count:-1}]}]]) {
    assert.throws(()=>importCompetitor(state,JSON.stringify(rows)));
    assert.equal(JSON.stringify(state),before);
  }
});
