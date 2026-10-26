import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {parseBirthDate} from './birthDate.js';

export const documentTypes = [
 {id:'application',label:'土地登記申請書',file:'application-normalized.pdf'},
 {id:'sale',label:'土地、建物買賣移轉契約書',file:'sale.pdf'},
 {id:'land-sale',label:'土地買賣移轉契約書',file:'sale.pdf'},
 {id:'building-sale',label:'建物買賣移轉契約書',file:'sale.pdf'},
 {id:'mortgage',label:'抵押權設定契約書',file:'mortgage.pdf'},
];
export const officialCatalog = 'https://landeasy.hccg.gov.tw/content/?mode=data&parent_id=273';
export const addressLabels=['縣市','鄉鎮市區','村里','鄰','街路','段','巷','弄','號','樓'];
export function validRocDate(value){
 const match=str(value).match(/^(\d{1,3})[\/年.-](\d{1,2})[\/月.-](\d{1,2})日?$/);
 if(!match)return false;
 const year=Number(match[1])+1911,month=Number(match[2]),day=Number(match[3]);
 const date=new Date(Date.UTC(year,month-1,day));return Number(match[1])>0&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
export function splitAddress(value='') {
 let rest=String(value).trim();
 const parts=Array(10).fill('');
 const take=(i,re)=>{const m=rest.match(re);if(m){parts[i]=m[0];rest=rest.slice(m[0].length);}};
 take(0,/^.{2,3}?[縣市]/);take(1,/^.{1,4}?[鄉鎮市區]/);take(2,/^.{1,5}?[村里]/);take(3,/^[\d一二三四五六七八九十百]+鄰/);
 take(4,/^.*?(?:大道|路|街)/);take(5,/^[\d一二三四五六七八九十]+段/);take(6,/^[^弄號樓]+巷/);take(7,/^[^號樓]+弄/);take(8,/^[^樓]+號(?:之\d+)?/);
 parts[9]=rest;
 return parts;
}
const str=v=>String(v??'').trim();
function validBirthDate(value){const raw=str(value).normalize('NFKC');if(!/^(?:民前|民國)?\s*[1-9]\d{0,3}\s*[\/年.-]/.test(raw))return false;try{return !!parseBirthDate(raw);}catch{return false;}}
function chosenProperties(data,type){return data.properties.filter(p=>p.included!==false&&(type!=='land-sale'||p.kind==='土地')&&(type!=='building-sale'||p.kind==='建物'));}
function relevantParties(data,type){const mortgage=type==='mortgage'||(type==='application'&&data.meta.reason==='抵押權設定');return data.parties.filter(p=>p.included!==false&&(mortgage?['creditor','mortgagor','debtor'].includes(p.role):['buyer','seller'].includes(p.role))).map(p=>p.personType==='legal'?{...p,birthDate:''}:p);}
export function missingFields(data,type) {
 const missing=[],m=data.meta,ps=chosenProperties(data,type),parties=relevantParties(data,type);
 if(!ps.length)missing.push('至少一筆登記標的');
 ps.forEach((p,i)=>{for(const [k,l] of [['city','縣市'],['district','鄉鎮市區'],['section','段'],['number',p.kind==='土地'?'地號':'建號'],['area','面積'],['share',type==='mortgage'?'設定持分':'移轉持分']])if(!str(p[k]))missing.push(`標的 ${i+1} ${l}`);});
 if(type!=='application')ps.filter(p=>p.kind==='建物').forEach((p,i)=>{
  for(const [k,l] of [['address','建物門牌'],['land','基地坐落地號'],...(type.includes('sale')?[['floor','層次'],['floorArea','各層面積']]:[])])if(!str(p[k]))missing.push(`建物 ${i+1} ${l}（無此項請明填「無」）`);
 });
 for(const role of (type==='mortgage'||(type==='application'&&m.reason==='抵押權設定'))?['creditor','mortgagor','debtor']:['buyer','seller'])if(!parties.some(p=>p.role===role))missing.push({buyer:'買受人',seller:'出賣人',creditor:'抵押權人',mortgagor:'設定義務人',debtor:'債務人'}[role]);
 parties.forEach((p,i)=>{for(const [k,l] of [['name','姓名／名稱'],['idNumber','統一編號'],['address','住所']])if(!str(p[k]))missing.push(`當事人 ${i+1} ${l}`);if(type.includes('sale')&&!str(p.share))missing.push(`當事人 ${i+1} 持分`);});
 parties.forEach((p,i)=>{
  if(p.personType==='legal')return;
  if(!str(p.birthDate))missing.push(`當事人 ${i+1} 出生年月日`);
  else if(!validBirthDate(p.birthDate))missing.push(`當事人 ${i+1} 有效出生日期（民國年/月/日）`);
 });
  if(type==='application'){if(!str(m.landOffice)||!str(m.receivingCity))missing.push('受理縣市及地政事務所');if(!validRocDate(m.causeDate))missing.push('有效的原因發生日期（民國年/月/日）');if(!str(m.attachments))missing.push('附繳證件');if(str(m.agentName)){if(!str(m.agentId)||!str(m.agentAddress))missing.push('代理人統一編號及住所');if(!validBirthDate(m.agentBirthDate))missing.push('代理人有效出生年月日');}}
 else {if(!validRocDate(m.contractDate))missing.push('有效的立約日期（民國年/月/日）');}
 if(type.includes('sale')){if(type==='sale'&&!str(m.totalPrice))missing.push('買賣價款總金額');if(type==='land-sale'&&!str(m.landPrice))missing.push('土地價款');if(type==='building-sale'&&!str(m.buildingPrice))missing.push('建物價款');}
 if(type==='mortgage'){for(const [k,l] of [['mortgageRight','提供擔保權利種類'],['mortgageAmount','擔保債權總金額'],['mortgageScope','擔保債權種類及範圍'],['repayment','債務清償日期'],['interest','利息'],['lateInterest','遲延利息'],['penalty','違約金']])if(!str(m[k]))missing.push(l);if(m.mortgageKind==='最高限額'&&!str(m.mortgageConfirmed))missing.push('擔保債權確定期日');}
 return missing;
}
function dateParts(value){if(str(value)&&!validRocDate(value))throw new Error('日期請填有效的民國年/月/日，例如 115/10/25。');const m=str(value).match(/^(\d{1,3})[\/年.-](\d{1,2})[\/月.-](\d{1,2})日?$/);return m?m.slice(1):['','',''];}

/** Coordinates follow the official landscape PDF rendered at 1400 x 990. */
export async function createRegistrationPdf(data,type,{loadAsset,reviewed=false}={}) {
 const def=documentTypes.find(d=>d.id===type);if(!def)throw new Error('請選擇文件。');
 const load=loadAsset|| (async path=>{const r=await fetch('/forms/'+path);if(!r.ok)throw new Error('官方範本讀取失敗，請重試。');return new Uint8Array(await r.arrayBuffer());});
 const [template,fontBytes]=await Promise.all([load(def.file),load('NotoSerifTC-Regular.ttf')]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const source=await PDFDocument.load(template),font=await pdf.embedFont(fontBytes,{subset:false});
 const incomplete=missingFields(data,type),draft=!reviewed||incomplete.length>0;
 const props=chosenProperties(data,type),parties=relevantParties(data,type),m=data.meta;
 if(props.length>4||parties.length>(type==='application'?6:4))throw new Error('這份官方表格一次最多帶入 4 筆標的及 '+(type==='application'?6:4)+' 位當事人，請分批勾選或另備續頁，避免資料被截斷。');
 const pages=await pdf.copyPages(source,source.getPageIndices());pages.forEach(p=>pdf.addPage(p));
 function box(page,value,x,y,w,h,{size=14,align='center',label='欄位'}={}){
  const s=str(value);if(!s)return;
  const sx=page.getWidth()/1400,sy=page.getHeight()/990;
  let lines=[],fontSize=size;
  function wrap(){lines=[];for(const raw of s.split('\n')){let line='';for(const c of raw){if(font.widthOfTextAtSize(line+c,fontSize*sx)>(w-7)*sx&&line){lines.push(line);line=c;}else line+=c;}lines.push(line);}}
  wrap();while(lines.length*(fontSize+3)>h-5&&fontSize>10){fontSize-=.5;wrap();}
  if(lines.length*(fontSize+3)>h-3)throw new Error(`${label}內容超出版面，請縮短文字或另附續頁。`);
  const lineH=(fontSize+3)*sy,total=lines.length*lineH;
  lines.forEach((line,i)=>{
   const width=Array.from(line).reduce((sum,c)=>sum+font.widthOfTextAtSize(c,fontSize*sx),0);
   let cursor=x*sx+(align==='left'?4*sx:Math.max(3*sx,(w*sx-width)/2));
   const baseline=page.getHeight()-(y*sy+(h*sy-total)/2+(i+1)*lineH)+3*sy;
   // Explicit glyph positions also avoid full CJK font CID advance differences between PDF viewers.
   for(const c of line){page.drawText(c,{font,size:fontSize*sx,color:rgb(0,0,0),x:cursor,y:baseline});cursor+=font.widthOfTextAtSize(c,fontSize*sx);}
  });
 }
 function tick(page,x,y){box(page,'✓',x,y,18,18,{size:15});}
 function address(page,party,xs,y,h){const parts=party.addressParts||splitAddress(party.address);xs.slice(0,-1).forEach((x,i)=>box(page,parts[i],x,y,xs[i+1]-x,h,{size:13,label:addressLabels[i]}));}
 function contractDate(page,y,xs){dateParts(m.contractDate).forEach((d,i)=>box(page,d,xs[i],y,90,32,{size:17,label:'立約日期'}));}
 const p=pages[0],q=pages[1];
 if(type.includes('sale')){
  const lands=props.filter(p=>p.kind==='土地'),buildings=props.filter(p=>p.kind==='建物');
  lands.forEach((a,i)=>{const x=295+i*65;[[a.district,232,93],[a.section,325,62],[a.subsection,387,62],[a.number,449,85],[a.area,534,107],[a.share,641,141]].forEach(([v,y,h])=>box(p,v,x,y,65,h,{size:12,label:'土地標示'}));});
  const floorNames=[...new Set(buildings.flatMap(a=>str(a.floor).split('\n').map(s=>s.trim()).filter(Boolean)))];
  if(floorNames.length>4)throw new Error('建物層次超過官方表格的 4 列，請分批勾選或另備續頁。');
  floorNames.forEach((v,i)=>box(p,v.replace(/層$/,''),681,481+i*26.7,88,26.7,{size:12,label:'層次'}));
  buildings.forEach((a,i)=>{const x=819+i*98,ap=a.addressParts||splitAddress(a.address);[[a.number,232,30],[a.district,263,30],[ap[4],294,31],[ap.slice(5,8).join(''),325,31],[ap.slice(8,10).join(''),356,31],[a.section,387,31],[a.subsection,418,31],[a.land,449,31],[a.area,614,27],[a.annex,641,50],[a.annexArea,691,61],[a.share,752,30]].forEach(([v,y,h])=>box(p,v,x,y,98,h,{label:'建物標示'}));const floors=str(a.floor).split('\n').map(s=>s.trim()).filter(Boolean),areas=str(a.floorArea).split('\n').map(s=>s.trim()).filter(Boolean);if(floors.length!==areas.length)throw new Error('建物層次與各層面積請逐行對應填寫。');if(new Set(floors).size!==floors.length)throw new Error('同一建物的層次不可重複，請核對各層面積。');floors.forEach((f,j)=>box(p,areas[j],x,481+floorNames.indexOf(f)*26.7,98,26.7,{label:'層次面積'}));});
  const price=type==='land-sale'?m.landPrice:type==='building-sale'?m.buildingPrice:m.totalPrice;
  box(p,price,445,784,840,68,{size:20,align:'left',label:'買賣價款'});
  box(q,m.otherTerms,160,175,477,274,{align:'left',label:'登記以外約定事項'});
  parties.forEach((a,i)=>{const y=582+i*62;box(q,a.role==='buyer'?'買受人':'出賣人',130,y,70,62);box(q,a.name,200,y,153,62,{label:'姓名'});box(q,a.share,a.role==='buyer'?353:412,y,59,62,{label:'持分'});box(q,a.birthDate,471,y,71,62,{size:12,label:'出生年月日'});box(q,a.idNumber,542,y,107,62,{size:13,label:'統一編號'});address(q,a,[649,731,790,850,883,958,1014,1051,1086,1131,1218],y,62);});
  contractDate(q,834,[530,803,1065]);
 }else if(type==='mortgage'){
  tick(p,610,m.mortgageKind==='最高限額'?176:144);
  props.filter(a=>a.kind==='土地').forEach((a,i)=>{const x=300+i*97;[[a.district,202,61],[a.section,263,63],[a.subsection,326,63],[a.number,389,115],[a.area,504,77],[a.share,581,94],[a.limitedAmount,675,122],[a.foreclosure,797,120]].forEach(([v,y,h])=>box(p,v,x,y,97,h,{label:'土地設定標示'}));});
  props.filter(a=>a.kind==='建物').forEach((a,i)=>{const x=936+i*92,ap=a.addressParts||splitAddress(a.address);[[a.number,202,30],[a.district,232,31],[ap[4],263,31],[ap.slice(5,8).join(''),294,32],[ap.slice(8,10).join(''),326,31],[a.section,357,31],[a.subsection,388,31],[a.land,419,31],[a.area,450,54],[a.annex,504,46],[a.annexArea,550,62],[a.share,612,63],[a.limitedAmount,675,122],[a.foreclosure,797,120]].forEach(([v,y,h])=>box(p,v,x,y,92,h,{label:'建物設定標示'}));});
  [m.mortgageRight,m.mortgageAmount,m.mortgageScope,m.mortgageKind==='最高限額'?m.mortgageConfirmed:'',m.repayment,m.interest,m.lateInterest,m.penalty,m.otherScope].forEach((v,i)=>box(q,v,445,94+i*40.8,855,40.8,{align:'left',label:'抵押條件'}));
  box(q,m.otherTerms,195,462,1100,132,{align:'left',label:'登記以外約定事項'});
  parties.forEach((a,i)=>{const y=718+i*38.4;box(q,({creditor:'權利人',mortgagor:'義務人',debtor:'債務人'})[a.role],172,y,80,38.4,{size:12});box(q,a.name,252,y,155,38.4,{label:'姓名'});box(q,a.share,407,y,51,38.4,{size:11,label:'債權額比例'});box(q,a.debtShare,458,y,44,38.4,{size:11,label:'債務額比例'});box(q,a.birthDate,502,y,82,38.4,{size:12,label:'出生年月日'});box(q,a.idNumber,584,y,97,38.4,{size:12,label:'統一編號'});address(q,a,[681,744,806,862,903,982,1025,1067,1109,1150,1212],y,38.4);});
  contractDate(q,873,[600,861,1113]);
 }else{
  box(p,m.receivingCity,220,269,105,48,{label:'受理縣市'});box(p,m.landOffice,350,269,69,36,{label:'地政事務所名稱'});dateParts(m.causeDate).forEach((d,i)=>box(p,d,[1055,1130,1195][i],282,i===0?53:40,36));
  const mortgage=m.reason==='抵押權設定';tick(p,120,mortgage?430:404);tick(p,mortgage?502:502,mortgage?430:403);tick(p,422,564);
  str(m.attachments).split('\n').slice(0,9).forEach((v,i)=>{const col=Math.floor(i/3),row=i%3,count=v.match(/^(.*?)\s*(\d+)\s*[份件]\s*$/);box(p,count?count[1]:v,205+col*370,588+row*26.5,260,26.5,{size:13,align:'left',label:'附繳證件'});if(count)box(p,count[2],475+col*370,588+row*26.5,40,26.5,{size:13,label:'證件份數'});});
  if(str(m.attachments).split('\n').length>9)throw new Error('附繳證件超過 9 項，請另附續頁。');
  box(p,m.agentName,505,668,70,28,{label:'代理人姓名'});box(p,m.notes,180,777,747,154,{align:'left',label:'備註'});
  box(p,parties.find(a=>a.role===(mortgage?'creditor':'buyer'))?.phone,1134,668,160,36,{size:12});box(p,parties.find(a=>a.role===(mortgage?'mortgagor':'seller'))?.phone,1134,704,160,35,{size:12});box(p,m.agentPhone||data.office.phone,1134,740,160,35,{size:12});
  const applicants=[...parties];if(str(m.agentName))applicants.push({role:'agent',name:m.agentName,birthDate:m.agentBirthDate,idNumber:m.agentId,address:m.agentAddress,addressParts:m.agentAddressParts});
  if(applicants.length>6)throw new Error('申請人加代理人超過 6 位，請分批勾選或另備續頁。');
  applicants.forEach((a,i)=>{const y=215+i*30.7;box(q,({buyer:'權利人',seller:'義務人',agent:'代理人',creditor:'權利人',mortgagor:'義務人',debtor:'債務人'})[a.role],169,y,100,30.7,{size:12});box(q,a.name,269,y,99,30.7,{size:12,label:'姓名'});box(q,a.birthDate,368,y,150,30.7,{size:13});box(q,a.idNumber,518,y,126,30.7,{size:13});address(q,a,[644,714,783,853,894,969,1008,1048,1088,1128,1208],y,30.7);});
 }
 pages.forEach((page,i)=>{box(page,`第 ${i+1} 頁／共 ${pages.length} 頁`,1030,951,300,22,{size:11});if(draft){page.drawText('待核對／待補填',{font,size:22,color:rgb(.65,.2,.15),opacity:.55,rotate:degrees(0),x:page.getWidth()*.40,y:16});}});
 pdf.setTitle(def.label);pdf.setSubject(draft?'待核對或待補填文件':'已完成使用者核對的套印文件');pdf.setCreator('LandMatch Office');pdf.setProducer('LandMatch Office');
 return {bytes:await pdf.save(),draft,missing:incomplete};
}
