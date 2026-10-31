import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {createRegistrationPdf,missingFields,splitAddress,validRocDate} from './registrationPdf.js';
import {applyPrintLayout} from './printLayout.js';

function fixture() {
 const property={included:true,city:'新北市',district:'五股區',section:'測試段',subsection:'',number:'0001-0000',area:'100.00',share:'1分之1',address:'新北市五股區測試路一段2巷3弄4號五樓',land:'0001-0000',floor:'五層',floorArea:'50.00',annex:'陽台',annexArea:'5.00',limitedAmount:'',foreclosure:'',kind:'土地'};
 const party=(role,name)=>({included:true,role,name,idNumber:'00000000',address:'新北市五股區測試路1號',birthDate:'80/05/21',phone:'0000000000',share:'1分之1',debtShare:'1分之1'});
 return {
  office:{name:'範例事務所',phone:'0000000000',address:'新北市五股區測試路1號'},
  meta:{receivingCity:'新北市',landOffice:'新莊',reason:'買賣',causeDate:'115/10/25',applicationDate:'115/10/25',agentName:'',agentRegistration:'',agentId:'',agentPhone:'',agentAddress:'',attachments:'身分證明文件 2 件\n所有權狀 2 件',notes:'',landPrice:'新臺幣壹佰萬元整',buildingPrice:'新臺幣貳佰萬元整',totalPrice:'新臺幣參佰萬元整',mortgageKind:'普通',mortgageRight:'所有權',mortgageAmount:'新臺幣壹佰萬元整',mortgageScope:'本次範例借款',mortgageConfirmed:'115/12/31',repayment:'116/12/31',interest:'無',lateInterest:'無',penalty:'無',otherScope:'',otherTerms:'',contractDate:'115/10/25'},
  properties:[property,{...property,kind:'建物',number:'00002-000',area:'50.00'}],
  parties:[party('buyer','測試買方'),party('seller','測試賣方'),party('creditor','測試權利人'),party('mortgagor','測試義務人'),party('debtor','測試債務人')]
 };
}

const loadAsset=async name=>new Uint8Array(await readFile(new URL('../public/forms/'+name,import.meta.url)));

test('Taiwan address components retain long township and road names without losing characters',()=>{
 const address='高雄市那瑪夏區達卡努瓦里十二鄰民生路三段2巷3弄4號之1五樓';
 const parts=splitAddress(address);
 assert.deepEqual(parts,['高雄市','那瑪夏區','達卡努瓦里','十二鄰','民生路','三段','2巷','3弄','4號之1','五樓']);
 assert.equal(parts.join(''),address);
 assert.deepEqual(splitAddress('新竹縣竹北市縣政二路6號十二樓'),['新竹縣','竹北市','','','縣政二路','','','','6號','十二樓']);
 assert.equal(splitAddress('五股區民義路一段172巷1號四樓')[0],'');
 assert.equal(splitAddress('五股區民義路一段172巷1號四樓').join(''),'五股區民義路一段172巷1號四樓');
 assert.deepEqual(splitAddress(''),Array(10).fill(''));
});

test('ROC dates reject Gregorian ISO, impossible dates, and zero years without rollover',()=>{
 for(const valid of ['115/10/25','115年10月25日','89/02/29','1/1/1'])assert.equal(validRocDate(valid),true,valid);
 for(const invalid of ['2026-10-25','115/02/29','114/04/31','0/01/01','115/13/01','115/01/00','115/1/32','',null])assert.equal(validRocDate(invalid),false,String(invalid));
});

test('document completeness only considers selected properties and roles for the chosen form',()=>{
 const data=fixture();
 data.parties.find(p=>p.role==='creditor').name='';
 data.properties[1].area='';
 assert.deepEqual(missingFields(data,'land-sale'),[]);
 assert.ok(missingFields(data,'building-sale').includes('標的 1 面積'));
 assert.ok(missingFields(data,'mortgage').includes('當事人 1 姓名／名稱'));
 data.properties[0].included=false;
 assert.ok(missingFields(data,'land-sale').includes('至少一筆登記標的'));
 data.parties.find(p=>p.role==='seller').included=false;
 assert.ok(missingFields(data,'sale').includes('出賣人'));
 data.meta.reason='抵押權設定';
 assert.ok(!missingFields(data,'application').includes('出賣人'));
});

test('sale prices and highest-limit mortgage terms are checked for the appropriate document',()=>{
 const data=fixture();
 data.meta.totalPrice='';
 data.meta.landPrice='';
 assert.ok(missingFields(data,'sale').includes('買賣價款總金額'));
 assert.ok(missingFields(data,'land-sale').includes('土地價款'));
 assert.deepEqual(missingFields(data,'building-sale'),[]);
 data.meta.mortgageConfirmed='';
 assert.deepEqual(missingFields(data,'mortgage'),[]);
 data.meta.mortgageKind='最高限額';
 assert.ok(missingFields(data,'mortgage').includes('擔保債權確定期日'));
});

test('missing building details and natural-person births keep output pending',()=>{
 const data=fixture();
 for(const key of ['address','land','floor','floorArea'])data.properties[1][key]='';
 data.parties[0].birthDate='';
 const missing=missingFields(data,'building-sale');
 for(const label of ['建物門牌','基地坐落地號','層次','各層面積','出生年月日'])assert.ok(missing.some(s=>s.includes(label)),label);
 data.parties[0].personType='legal';
 assert.ok(!missingFields(data,'land-sale').some(s=>s.includes('出生')));
 data.parties[1].birthDate='民前1/05/21';
 assert.deepEqual(missingFields(data,'land-sale'),[]);
});

test('official templates produce two-page PDF documents with embedded Traditional Chinese font',async t=>{
 for(const type of ['application','sale','land-sale','building-sale','mortgage']){
  await t.test(type,async()=>{
   const result=await createRegistrationPdf(fixture(),type,{loadAsset,reviewed:true});
   assert.deepEqual(result.missing,[]);
   assert.equal(result.draft,false);
   assert.ok(result.bytes.byteLength>1_000_000,'embedded font should travel with downloaded PDF');
   const pdf=await PDFDocument.load(result.bytes);
   assert.equal(pdf.getPageCount(),2);
   assert.ok(pdf.getPages().every(page=>page.getWidth()>page.getHeight()),'both official pages retain landscape layout');
   assert.equal(pdf.getCreator(),'LandMatch Office');
   assert.equal(pdf.getSubject(),'已完成使用者核對的套印文件');
  });
 }
});

test('unreviewed or incomplete documents remain explicitly marked as drafts',async()=>{
 const pending=await createRegistrationPdf(fixture(),'sale',{loadAsset});
 assert.equal(pending.draft,true);
 const data=fixture();data.meta.landPrice='';
 const incomplete=await createRegistrationPdf(data,'land-sale',{loadAsset,reviewed:true});
 assert.equal(incomplete.draft,true);
 assert.ok(incomplete.missing.includes('土地價款'));
 const pdf=await PDFDocument.load(incomplete.bytes);
 assert.equal(pdf.getSubject(),'待核對或待補填文件');
});

test('excess properties or parties are rejected instead of silently clipping registration data',async()=>{
 const data=fixture();
 data.properties=Array.from({length:5},(_,i)=>({...data.properties[0],number:`000${i}-0000`}));
 await assert.rejects(createRegistrationPdf(data,'land-sale',{loadAsset}),/最多帶入 4 筆標的/);
 const people=fixture();
 people.parties=Array.from({length:5},(_,i)=>({...people.parties[0],name:`測試買方${i}`}));
 await assert.rejects(createRegistrationPdf(people,'sale',{loadAsset}),/4 位當事人/);
 const applicants=fixture();
 applicants.parties=Array.from({length:6},(_,i)=>({...applicants.parties[0],name:`測試申請人${i}`}));
 Object.assign(applicants.meta,{agentName:'測試代理人',agentId:'00000000',agentAddress:'新北市五股區測試路1號'});
 await assert.rejects(createRegistrationPdf(applicants,'application',{loadAsset}),/申請人加代理人超過 6 位/);
});

test('invalid operative dates and overflowing text fail PDF generation',async()=>{
 const badContract=fixture();badContract.meta.contractDate='2026-10-25';
 await assert.rejects(createRegistrationPdf(badContract,'sale',{loadAsset}),/日期請填有效的民國/);
 const badCause=fixture();badCause.meta.causeDate='115/02/29';
 await assert.rejects(createRegistrationPdf(badCause,'application',{loadAsset}),/日期請填有效的民國/);
 const overflow=fixture();overflow.parties[0].name='範例姓名'.repeat(100);
 await assert.rejects(createRegistrationPdf(overflow,'sale',{loadAsset}),/內容超出版面/);
});

test('gift and inheritance use their own official templates and explicit roles, with A3 portrait output',async()=>{
 for(const type of ['gift','inheritance-tree','inheritance-partition']){
  const data=fixture();
  data.meta.giftValue='新臺幣壹佰萬元整';data.meta.deathDate='115/01/01';
  data.properties.forEach(p=>p.allocation='測試繼承人 全部1分之1');
  data.parties=type==='gift'?data.parties.slice(0,2).map((p,i)=>({...p,role:i?'donor':'donee'})):[{role:'decedent',name:'測試被繼承人'},{...data.parties[0],role:'heir',name:'測試繼承人',relationship:'長子'}];
  assert.deepEqual(missingFields(data,type),[],type);
  const result=await createRegistrationPdf(data,type,{loadAsset,reviewed:true});
  assert.equal(result.draft,false,type);
  const original=await PDFDocument.load(result.bytes);
  assert.equal(original.getPageCount(),type==='gift'?2:1,type);
  const output=await PDFDocument.load(await applyPrintLayout(result.bytes,'a3'));
  assert.equal(output.getPageCount(),1,type);
  assert.ok(Math.abs(output.getPage(0).getWidth()-841.89)<.02);
  assert.ok(Math.abs(output.getPage(0).getHeight()-1190.55)<.02);
 }
});

test('sale roles never become donors or heirs, and inheritance allocations are not invented',()=>{
 const data=fixture();
 assert.ok(missingFields(data,'gift').includes('受贈人'));
 assert.ok(missingFields(data,'gift').includes('贈與人'));
 assert.ok(missingFields(data,'inheritance-tree').includes('繼承人'));
 assert.ok(missingFields(data,'inheritance-tree').includes('被繼承人'));
 assert.ok(missingFields(data,'inheritance-partition').some(s=>s.includes('遺產權利人及繼承持分')));
 data.meta.reason='贈與';
 assert.ok(missingFields(data,'application').includes('受贈人'));
 data.meta.reason='繼承';
 assert.ok(missingFields(data,'application').includes('繼承人'));
});
