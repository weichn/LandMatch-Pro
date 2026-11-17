import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTranscript,allFields,textItemsToLines} from './transcript.js';
const header='測試區測試段 0123-0000地號';
const land=`${header}\n土地標示部\n面 積：***123.45平方公尺\n土地所有權部\n（0001）登記次序：0001\n所有權人：測＊＊\n統一編號：A123456789\n權利範圍：***100分之25***\n土地他項權利部\n（0001）登記次序：0002-000 權利種類：最高限額抵押權\n權 利 人：範例銀行\n擔保債權總金額：新台幣***1,200,000元正`;
test('separates owner from creditor and omits identity number',()=>{
 const r=parseTranscript([land]),p=r.properties[0];
 assert.equal(p.owners[0].fields.find(f=>f.key==='name').value,'測**');
 assert.equal(p.rights[0].fields.find(f=>f.key==='creditor').value,'範例銀行');
 assert.equal(JSON.stringify(r).includes('A123456789'),false);
 assert.equal(allFields(r).every(f=>!f.reviewed),true);
});
test('continues rights across physical PDF pages, preserving source page',()=>{
 const r=parseTranscript([land,`${header}\n證明書字號：測試證號\n共同擔保建號：測試段00100-000`]);
 assert.equal(r.properties.length,1);
 assert.equal(r.properties[0].rights[0].fields.find(f=>f.key==='certificate').page,2);
});
test('keeps common share separate from ownership and does not add areas',()=>{
 const r=parseTranscript(['測試區測試段 00100-000建號\n建物標示部\n層數：005層 總面積：***60.00平方公尺\n附屬建物用途：陽台 面積：***5.00平方公尺\n共有部分：測試段00101-000建號***80.00平方公尺\n權利範圍：***10分之1***\n建物所有權部\n（0001）登記次序：0001\n所有權人：測＊＊\n權利範圍：全部***1分之1***']);
 const p=r.properties[0];
 assert.equal(p.fields.find(f=>f.key==='area').value,'60.00');
 assert.equal(p.common[0].fields.find(f=>f.key==='share').value,'10分之1');
 assert.equal(p.owners[0].fields.find(f=>f.key==='share').value,'全部1分之1');
});
test('scan or unrelated document is not silently imported',()=>assert.equal(parseTranscript(['']).properties.length,0));
test('warns on conflicts and masked names, without inventing addresses',()=>{
 const r=parseTranscript([land,`${header}\n土地標示部\n面積：999.00平方公尺`]);
 assert(r.warnings.some(w=>w.includes('不同值')));
 assert(r.warnings.some(w=>w.includes('住址未')));
 assert.equal(r.properties[0].fields.find(f=>f.key==='area').value,'123.45');
});
test('sorts PDF fragments geometrically into lines',()=>{
 const items=[{str:'second',transform:[1,0,0,1,0,10]},{str:'right',transform:[1,0,0,1,100,20]},{str:'left',transform:[1,0,0,1,0,20]}];
 assert.deepEqual(textItemsToLines(items),['left right','second']);
});
