#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mergeMutableRecord, sameItem, stableJson } from './lib/mutable-archive.mjs';
import { whatDoTheyKnowCommonsItem } from './lib/whatdotheyknow-commons.mjs';

assert.equal(sameItem({a:1,optional:undefined},{a:1}),true,'undefined object properties must be omitted like JSON.stringify');
assert.equal(sameItem([1,undefined,3],[1,null,3]),true,'undefined array entries must persist as null');
assert.equal(stableJson({b:2,a:1}),stableJson({a:1,b:2}),'object key order must not create revisions');

const request={sourceId:'street_trees',sourceType:'foi-request',url:'https://www.whatdotheyknow.com/request/street_trees',title:'Street trees',authority:{name:'Ealing Borough Council',urlName:'ealing_borough_council',url:'https://www.whatdotheyknow.com/body/ealing_borough_council'},status:'waiting_response',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',summary:'Tree information',correspondence:[],attachments:[],tags:[]};
const first=whatDoTheyKnowCommonsItem(request);
assert.equal(first.id,'whatdotheyknow:ealing_borough_council:street_trees');
assert.equal(first.sourceId,'whatdotheyknow');
assert.equal(first.mutableSource.status,'waiting_response');
assert.equal(first.requester,undefined,'requester must not become a Commons person field');
const inserted=mergeMutableRecord(null,first,'2026-01-02T00:00:00.000Z');
assert.equal(inserted.action,'insert');
const unchanged=mergeMutableRecord(inserted.record,{...first,optional:undefined},'2026-01-03T00:00:00.000Z');
assert.equal(unchanged.action,'unchanged');
const changed=whatDoTheyKnowCommonsItem({...request,status:'successful',updatedAt:'2026-01-04T00:00:00.000Z',attachments:[{name:'response.pdf',url:'https://www.whatdotheyknow.com/request/street_trees/response.pdf',contentType:'application/pdf'}]});
const updated=mergeMutableRecord(inserted.record,changed,'2026-01-04T01:00:00.000Z');
assert.equal(updated.action,'update');
assert.equal(updated.record.version,2);
assert.equal(updated.record.item.mutableSource.status,'successful');
assert.equal(updated.record.item.mutableSource.attachments.length,1);
assert.equal(updated.record.revisions.length,1);
console.log('Mutable archive JSON semantics, insert/update/idempotence and WDTK mapping OK.');
