import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReviewedDraft,toStoragePayload} from './transcriptDraft.js';
const fixture=()=>({version:1,pageCount:2,status:'reviewed-local-draft',exportedAt:'2026-01-01',warnings:['untrusted note'],properties:[{kind:'土地',key:'old',pages:[1],fields:[['district','測試區'],['section','測試段'],['number','0001-0000'],['area','100.00']].map(([key,value])=>({key,value,page:1,reviewed:true,label:'untrusted label',source:'not sent'})),owners:[{fields:[{key:'name',value:'測**',page:2,reviewed:true}]}],common:[],rights:[]}]});
test('old downloaded draft restores verified fields without PDF or raw metadata',()=>{
 const r=readReviewedDraft(JSON.stringify(fixture()));assert.equal(r.properties[0].owners[0].fields[0].reviewed,true);assert.equal(r.properties[0].fields.find(f=>f.key==='area').label,'面積（㎡）');assert.equal(JSON.stringify(toStoragePayload(r)).includes('untrusted'),false);assert.equal(JSON.stringify(toStoragePayload(r)).includes('source'),false);
});
test('rejects unchecked draft and false string',()=>{for(const reviewed of [false,'true']){const r=fixture();r.properties[0].fields[0].reviewed=reviewed;assert.throws(()=>toStoragePayload(r));}});
test('rejects hidden identity fields and values',()=>{const r=fixture();r.properties[0].owners[0].fields[0].value='A123456789';assert.throws(()=>toStoragePayload(r));r.properties[0].owners[0].fields[0]={key:'national_id',value:'masked',page:1,reviewed:true};assert.throws(()=>toStoragePayload(r));});
test('rejects malformed or oversized arrays and invalid source pages',()=>{for(const value of [null,{},[],{...fixture(),pageCount:41}])assert.throws(()=>toStoragePayload(value));const r=fixture();r.properties[0].fields[0].page=3;assert.throws(()=>toStoragePayload(r));});
test('canonical payload ignores field order and export timestamps',()=>{const a=fixture(),b=fixture();b.properties[0].fields.reverse();b.exportedAt='other';assert.deepEqual(toStoragePayload(a),toStoragePayload(b));});
test('rejects duplicate property and duplicate field',()=>{const a=fixture();a.properties.push(structuredClone(a.properties[0]));assert.throws(()=>toStoragePayload(a));const b=fixture();b.properties[0].fields.push(structuredClone(b.properties[0].fields[0]));assert.throws(()=>toStoragePayload(b));});
