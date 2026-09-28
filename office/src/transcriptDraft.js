import {allFields} from './transcript.js';
export const fieldLabels={district:'行政區',section:'段／小段',number:'地號／建號',issued:'列印時間',area:'面積（㎡）',zone:'使用分區',category:'使用地類別',announced:'公告土地現值（元／㎡）',address:'地址',land:'坐落地號',use:'主要用途',material:'主要建材',floors:'層數',floor:'層次',floorArea:'層次面積（㎡）',completed:'建築完成日期',annex:'附屬建物用途',annexArea:'附屬建物面積（㎡）',sequence:'登記次序',name:'所有權人',share:'權利範圍',registered:'登記日期',type:'權利種類',creditor:'權利人',amount:'擔保債權總金額（元）',certificate:'證明書字號',jointLand:'共同擔保地號',jointBuilding:'共同擔保建號'};
const keys={土地:['district','section','number','issued','area','zone','category','announced'],建物:['district','section','number','issued','address','land','use','material','floors','area','floor','floorArea','completed','annex','annexArea'],owners:['sequence','name','address','share','registered'],common:['number','area','share'],rights:['sequence','type','creditor','amount','certificate','jointLand','jointBuilding']};
const fail=()=>{throw new Error('草稿格式不符或尚未全部核對。請選擇工作台下載的「謄本核對草稿.json」。');};
export function toStoragePayload(input){
 if(!input||input.version!==1||!Number.isInteger(input.pageCount)||input.pageCount<1||input.pageCount>40||!Array.isArray(input.properties)||!input.properties.length||input.properties.length>30)fail();
 function fields(list,allowed){
  if(!Array.isArray(list)||!list.length||list.length>25)fail();
  const seen=new Set();
  return list.map(f=>{
   if(!f||!allowed.includes(f.key)||seen.has(f.key)||f.reviewed!==true||typeof f.value!=='string'||!f.value.trim()||f.value.length>1000||!Number.isInteger(f.page)||f.page<1||f.page>input.pageCount)fail();
   if(/[A-Z](?:[0-9]{9}|[A-D][0-9]{8})/.test(f.value.normalize('NFKC').toUpperCase().replace(/[\s-]/g,'')))throw new Error('草稿含疑似身分證或居留證字號，不能以明文存入案件。請移除後再試。');
   seen.add(f.key);return {key:f.key,value:f.value.trim(),page:f.page,reviewed:true};
  }).sort((a,b)=>a.key.localeCompare(b.key,'en'));
 }
 const properties=input.properties.map(p=>{
  if(!p||!['土地','建物'].includes(p.kind))fail();
  const f=fields(p.fields,keys[p.kind]);
  if(!['district','section','number','area'].every(k=>f.some(x=>x.key===k)))fail();
  const result={kind:p.kind,fields:f};
  for(const k of ['owners','common','rights']){
   if(!Array.isArray(p[k])||p[k].length>100)fail();
   result[k]=p[k].map(g=>({fields:fields(g.fields,keys[k])}));
  }
  return result;
 });
 const identity=p=>p.kind+'|'+['district','section','number'].map(k=>p.fields.find(f=>f.key===k).value).join('|');
 if(new Set(properties.map(identity)).size!==properties.length)fail();
 properties.sort((a,b)=>identity(a).localeCompare(identity(b),'en'));
 const payload={version:1,pageCount:input.pageCount,properties};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>240000)fail();
 return payload;
}
export function readReviewedDraft(text){
 if(text.length>500000)fail();
 const raw=JSON.parse(text);
 if(raw.status!=='reviewed-local-draft')fail();
 const data=toStoragePayload(raw);
 data.properties.forEach((p,i)=>{p.key=`draft-${i}`;p.pages=[...new Set(p.fields.map(f=>f.page))];});
 allFields(data).forEach(f=>{f.label=fieldLabels[f.key];f.source='已核對草稿（未包含原始 PDF）';});
 data.warnings=['已讀回草稿中的核對狀態，不需重打。存入前請確認目標事務所與案件。','姓名遮蔽與原文字層缺漏仍須注意；此草稿不代表完整客戶身分，也不會自動合併客戶。'];
 return data;
}

