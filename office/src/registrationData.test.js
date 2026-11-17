import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRegistrationData} from './registrationData.js';

const fields = entries => Object.entries(entries).map(([key,value])=>({key,value,reviewed:true}));
const property = (overrides={}) => ({kind:'土地',fields:fields({district:'五股區',section:'陸光段',number:'0790-0000',area:'218.15'}),owners:[{fields:fields({name:'陳**',share:'1000分之108'})}],rights:[{fields:fields({amount:'1680000',creditor:'某銀行',type:'最高限額抵押權'})}],common:[],...overrides});
const snapshot = (properties,created_at='2026-10-25T00:00:00Z') => ({created_at,payload:{properties}});

test('prefills the reviewed title share without inventing parties or new transaction terms',()=>{
 const input = {caseRow:{title:'王先生買賣案',opened_on:'2026-10-25',primary_contact_id:'primary'},office:{name:'桓宸事務所',phone:'03-123',address:'桃園市'},transcripts:[snapshot([property()])],parties:[]};
 const before = JSON.stringify(input);
 const data = initialRegistrationData(input);
 assert.deepEqual(data.parties,[]);
 assert.equal(data.properties[0].originalShare,'1000分之108');
 assert.equal(data.properties[0].share,'1000分之108');
 assert.equal(data.properties[0].price,'');
 assert.equal(data.meta.mortgageAmount,'');
 assert.equal(data.meta.mortgageKind,'普通');
 assert.equal(data.meta.contractDate,'');
 assert.equal(data.meta.causeDate,'');
 assert.equal(data.meta.agentName,'');
 assert.equal(data.office.name,'桓宸事務所');
 assert.equal(JSON.stringify(input),before);
});

test('deduplicates by property identity using newest snapshot and reports conflicting values',()=>{
 const oldest = property({fields:fields({district:'五股區',section:'陸光段',number:'0790-0000',area:'200'})});
 const newest = property();
 const data = initialRegistrationData({transcripts:[snapshot([oldest],'2026-09-01'),snapshot([newest],'2026-10-01'),snapshot([newest],'2026-10-02')]});
 assert.equal(data.properties.length,1);
 assert.equal(data.properties[0].area,'218.15');
 assert.equal(data.sourceWarnings.filter(w=>w.includes('不同核對紀錄')).length,1);
});

test('resolves a unique district county while skipping unreviewed values',()=>{
 const source = property({fields:[...fields({district:'五股區',section:'陸光段二小段',number:'0790-0000',area:'（空白）'}),{key:'address',value:'未核對地址',reviewed:false}]});
 const data = initialRegistrationData({transcripts:[snapshot([source])]});
 assert.equal(data.properties[0].city,'新北市');
 assert.equal(data.properties[0].section,'陸光段');
 assert.equal(data.properties[0].subsection,'二小段');
 assert.equal(data.properties[0].area,'');
 assert.equal(data.properties[0].address,'');
 assert.ok(data.sourceWarnings.some(w=>w.includes('未核對')));
});

test('preserves all common portions in parallel fields and never infers their transfer share',()=>{
 const source = property({kind:'建物',common:[{fields:fields({number:'03157-000',area:'86.37',share:'10分之1'})},{fields:fields({number:'03158-000',area:'20',share:'20分之1'})}]});
 const {properties:[row]} = initialRegistrationData({transcripts:[snapshot([source])]});
 assert.equal(row.commonNumber,'03157-000\n03158-000');
 assert.equal(row.commonArea,'86.37\n20');
 assert.equal(row.commonShare,'10分之1\n20分之1');
 assert.equal(row.share,'1000分之108');
});

test('base land number removes only the matching section prefix',()=>{
 const data=initialRegistrationData({transcripts:[snapshot([property({kind:'建物',fields:fields({district:'五股區',section:'陸光段',number:'03150-000',land:'陸光段0790-0000'})})])]});
 assert.equal(data.properties[0].land,'0790-0000');
});

test('auto-fills the sample land and building title shares without source mutations',()=>{
 const land=property();
 const building=property({kind:'建物',fields:fields({district:'五股區',section:'陸光段',number:'03150-000',area:'55.42'}),owners:[{fields:fields({share:'全部1分之1'})}]});
 const source={transcripts:[snapshot([land,building])]};
 const before=JSON.stringify(source);
 const data=initialRegistrationData(source);
 assert.deepEqual(data.properties.map(p=>[p.city,p.share]),[['新北市','1000分之108'],['新北市','全部1分之1']]);
 data.properties[0].share='1000分之54';
 assert.equal(JSON.stringify(source),before);
});

test('ambiguous districts and multiple owners are never arbitrarily selected',()=>{
 const ambiguous=property({fields:fields({district:'中正區',section:'測試段',number:'0001-0000',area:'1'}),owners:[{fields:fields({sequence:'0001',share:'2分之1'})},{fields:fields({sequence:'0002',share:'2分之1'})}]});
 const row=initialRegistrationData({office:{address:'新北市五股區某路'},transcripts:[snapshot([ambiguous])]}).properties[0];
 assert.equal(row.city,'');
 assert.equal(row.share,'');
 assert.equal(row.ownerShares.length,2);
 const prefixed=property({fields:fields({district:'台北市中正區',section:'測試段',number:'0002-0000',area:'1'})});
 const known=initialRegistrationData({transcripts:[snapshot([prefixed])]}).properties[0];
 assert.equal(known.city,'臺北市');
 assert.equal(known.district,'中正區');
});

test('unreviewed ownership shares do not become transaction shares',()=>{
 const row=property({owners:[{fields:[{key:'share',value:'全部1分之1',reviewed:false}]}]});
 assert.equal(initialRegistrationData({transcripts:[snapshot([row])]}).properties[0].share,'');
});

test('maps explicit contacts, converts ROC births, and does not read identity numbers',()=>{
 const contact = {display_name:' 買方甲 ',birth_date:'1991-05-21',address:'臺北市某路',phone:'02-123',national_id:'A123456789'};
 const data = initialRegistrationData({parties:[{id:'1',contact_id:'c1',role:'buyer',contacts:contact},{id:'2',contact_id:'c1',role:'buyer',contacts:contact},{id:'3',contact_id:'c1',role:'seller',contacts:{...contact,birth_date:'1911-12-31'}}]});
 assert.equal(data.parties.length,2);
 assert.equal(data.parties[0].name,'買方甲');
 assert.equal(data.parties[0].birthDate,'80/05/21');
 assert.equal(data.parties[1].birthDate,'民前1/12/31');
 assert.equal(data.parties[0].idNumber,'');
 assert.equal(data.parties[0].share,'');
 assert.equal(data.parties[0].debtShare,'');
});

test('malformed rows cannot create false parties or merge unrelated incomplete properties',()=>{
 const incomplete = property({fields:fields({area:'2'})});
 const data = initialRegistrationData({transcripts:[null,{payload:{}},snapshot([null,{kind:'其他'},incomplete,incomplete])],parties:[null,{role:'creditor',contacts:{}},{role:'buyer',contacts:null},{role:'seller',contacts:{display_name:'甲',birth_date:'1991-02-30'}}]});
 assert.equal(data.properties.length,2);
 assert.equal(data.parties.length,1);
 assert.equal(data.parties[0].birthDate,'');
 assert.ok(data.sourceWarnings.length>=4);
 assert.deepEqual(initialRegistrationData().properties,[]);
 assert.deepEqual(initialRegistrationData({transcripts:'not an array',parties:{}}).parties,[]);
});
