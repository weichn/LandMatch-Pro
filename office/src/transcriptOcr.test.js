import {test} from 'node:test';
import assert from 'node:assert/strict';
import {needsOcr,ocrScale} from './transcriptOcr.js';
import {parseTranscript,allFields} from './transcript.js';
test('blank and short watermark-only pages request OCR',()=>{
 assert(needsOcr([]));assert(needsOcr(['掃描文件 1']));
 assert.equal(needsOcr(['土地標示部 面積：100.00平方公尺 所有權人：測試資料 權利範圍：全部']),false);
});
test('render scale limits pixels and dimension for huge PDF pages',()=>{
 for(const [w,h] of [[595,842],[10000,20000],[100000,1]]){
  const scale=ocrScale(w,h);assert(w*h*scale*scale<=8000001);assert(Math.max(w,h)*scale<=4000.01);
 }
 assert.throws(()=>ocrScale(0,100));
});
test('unidentified OCR page cannot inherit previous property or silently disappear',()=>{
 assert.throws(()=>parseTranscript(['測試區測試段0123-0000地號\n土地標示部\n面積：123平方公尺','土地所有權部\n所有權人：另一人'],{ocrPages:[2]}),/ocr-heading:2/);
});
test('OCR missing area stays empty and unreviewed; source remains marked',()=>{
 const r=parseTranscript(['測試區測試段0123-0000地號\n土地標示部'],{ocrPages:[1]});
 const area=r.properties[0].fields.find(f=>f.key==='area');
 assert.equal(area.value,'');assert.equal(area.reviewed,false);
 assert(allFields(r).every(f=>f.source.startsWith('影像辨識')));
 assert(r.warnings.some(w=>w.includes('小數點')));
});
