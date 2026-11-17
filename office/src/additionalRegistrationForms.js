const text=value=>String(value??'').trim();
const lines=value=>text(value).split('\n').map(v=>v.trim()).filter(Boolean);

export const inheritanceRelationships=['配偶','長子','次子','三子','長女','次女','三女'];

function addressParts(person){
 if(Array.isArray(person.addressParts))return person.addressParts;
 let rest=text(person.address);
 const result=Array(10).fill('');
 const take=(i,re)=>{const m=rest.match(re);if(m){result[i]=m[0];rest=rest.slice(m[0].length);}};
 take(0,/^.{2,3}?[縣市]/);take(1,/^.{1,4}?[鄉鎮市區]/);take(2,/^.{1,5}?[村里]/);take(3,/^[\d一二三四五六七八九十百]+鄰/);
 take(4,/^.*?(?:大道|路|街)/);take(5,/^[\d一二三四五六七八九十]+段/);take(6,/^[^弄號樓]+巷/);take(7,/^[^號樓]+弄/);take(8,/^[^樓]+號(?:之\d+)?/);result[9]=rest;
 return result;
}

function birthParts(value){
 const s=text(value).normalize('NFKC');
 if(!s)return ['','',''];
 const match=s.match(/^(民前|民國)?\s*(\d{1,3})\s*[/年.-]\s*(\d{1,2})\s*[/月.-]\s*(\d{1,2})\s*日?$/);
 if(!match)throw new Error('繼承系統表的出生日期請使用民國年/月/日；民國前可填「民前1/01/01」。');
 return [match[1]==='民前'?'前'+match[2]:match[2],match[3],match[4]];
}

/** Draw the three verified official templates. All signature/seal areas remain untouched. */
export function renderAdditionalForm({type,pages,data,props,parties,box,dateParts}){
 const m=data.meta||{};
 if(type==='gift'){
  if(pages.length!==2)throw new Error('贈與契約書官方範本應為兩頁，請重新載入。');
  const [first,second]=pages;
  const lands=props.filter(p=>p.kind==='土地'),buildings=props.filter(p=>p.kind==='建物');
  const people=parties.filter(p=>['donor','donee'].includes(p.role));
  if(lands.length>4||buildings.length>4||people.length>4)throw new Error('贈與官方表格最多四筆土地、四筆建物及四位當事人，請另備續頁。');
  lands.forEach((p,i)=>{
   const x=283+i*86;
   [[p.district,252,93],[p.section,345,62],[p.subsection,407,62],[p.number,469,94],[p.area,563,124],[p.share,687,196]]
    .forEach(([value,y,height])=>box(first,value,x,y,86,height,{size:13,label:'贈與土地標示'}));
  });
  const floorNames=[...new Set(buildings.flatMap(p=>lines(p.floor)))];
  if(floorNames.length>4)throw new Error('贈與契約書最多四個建物層次，請另備續頁。');
  floorNames.forEach((name,i)=>box(first,name.replace(/層$/,''),744,500+i*31.2,86,31.2,{size:13,label:'建物層次'}));
  buildings.forEach((p,i)=>{
   const x=877+i*112.2,parts=addressParts(p);
   [[p.number,252,31],[p.district,283,31],[parts[4],314,31],[parts.slice(5,8).join(''),345,31],[parts.slice(8,10).join(''),376,31],
    [p.section,407,31],[p.subsection,438,31],[p.land,469,31],[p.area,656,31],[p.annex,687,48],[p.annexArea,735,91],[p.share,826,57]]
    .forEach(([value,y,height])=>box(first,value,x,y,112.2,height,{size:13,label:'贈與建物標示'}));
   const floors=lines(p.floor),areas=lines(p.floorArea);
   if(floors.length!==areas.length)throw new Error('建物層次與各層面積請逐行對應填寫。');
   if(new Set(floors).size!==floors.length)throw new Error('同一建物層次不可重複，請核對後再產生贈與契約。');
   floors.forEach((floor,j)=>box(first,areas[j],x,500+floorNames.indexOf(floor)*31.2,112.2,31.2,{size:13,label:'建物各層面積'}));
  });
  box(second,m.giftValue,326,226,335,35,{size:16,align:'left',label:'贈與權利價值'});
  box(second,m.otherTerms,160,283,510,189,{size:14,align:'left',label:'贈與其他約定'});
  people.forEach((person,i)=>{
   const y=611+i*52.8;
   box(second,person.role==='donee'?'受贈人':'贈與人',130,y,74,52.8,{size:13});
   box(second,person.name,204,y,175,52.8,{size:14,label:'姓名／名稱'});
   box(second,person.share,person.role==='donee'?379:448,y,person.role==='donee'?69:60,52.8,{size:12,label:'贈與持分'});
   box(second,person.personType==='legal'?'':person.birthDate,508,y,69,52.8,{size:12,label:'出生年月日'});
   box(second,person.idNumber,577,y,106,52.8,{size:12,label:'統一編號'});
   const p=addressParts(person),values=[p[0],p[1],p[2],p[3],p[4],p[5],p[6]+p[7],p[8],p[9]],xs=[683,754,825,884,919,990,1037,1108,1155,1202];
   values.forEach((value,j)=>box(second,value,xs[j],y,xs[j+1]-xs[j],52.8,{size:12,label:'住所'}));
  });
  dateParts(m.contractDate).forEach((value,i)=>box(second,value,[560,817,1073][i],827,112,35,{size:17,label:'立約日期'}));
  return true;
 }

 if(!['inheritance-tree','inheritance-partition'].includes(type))return false;
 if(pages.length!==1)throw new Error('此繼承官方書表應為一頁，請重新載入。');
 const page=pages[0],decedents=parties.filter(p=>p.role==='decedent'),heirs=parties.filter(p=>p.role==='heir');
 if(decedents.length>1)throw new Error('每份繼承書表限一位被繼承人，請分別製作。');
 const deceased=decedents[0]||{};
 // Portrait forms were measured at 990 x 1400 and transformed to the shared box grid.
 const portrait=(value,x,y,width,height,options={})=>box(page,value,x*1400/990,y*990/1400,width*1400/990,height*990/1400,{size:18,...options});
 const date=(value,xs,y,height=42)=>value.forEach((part,i)=>portrait(part,xs[i],y,28,height,{size:15,label:'日期'}));
 if(type==='inheritance-tree'){
  if(heirs.length>7)throw new Error('本版繼承系統表最多帶入配偶及六位子女，請另備續頁。');
  const known=new Set();
  for(const heir of heirs){
   if(!inheritanceRelationships.includes(heir.relationship))throw new Error('請明確選擇繼承人與被繼承人的關係；本官方表格限定配偶及長、次、三子女，其他系統請使用官方空白表另繪。');
   if(known.has(heir.relationship))throw new Error('繼承人關係重複，無法填入同一個官方欄位，請重新核對。');
   known.add(heir.relationship);
  }
  portrait(deceased.name,228,130,210,50,{size:21,label:'被繼承人姓名'});
  date(dateParts(m.deathDate),[144,194,234],182);
  const spouse=heirs.find(p=>p.relationship==='配偶');
  if(spouse){portrait(spouse.name,222,301,215,50,{size:21,label:'配偶姓名'});date(birthParts(spouse.birthDate),[144,194,234],351);}
  const children=['長子','次子','三子','長女','次女','三女'];
  heirs.filter(p=>p.relationship!=='配偶').forEach(person=>{
   const row=children.indexOf(person.relationship),y=130+row*56.5;
   portrait(person.name,518,y,150,50,{size:20,label:'繼承人姓名'});
   date(birthParts(person.birthDate),[714,764,814],139+row*56.5);
  });
  // The four 申請人/住址 pairs are signature locations. Heirs and applicants are not interchangeable.
  // Leave these pairs blank instead of assuming the first four heirs will sign as applicants.
  date(dateParts(m.contractDate),[411,531,650],1220,52);
  return true;
 }

 if(heirs.length>4)throw new Error('本遺產分割協議書最多四位立協議書人，請另備續頁。');
 const lands=props.filter(p=>p.kind==='土地'),buildings=props.filter(p=>p.kind==='建物');
 if(lands.length>5||buildings.length>3)throw new Error('本官方遺產分割協議書最多五筆土地及三筆建物，請另備續頁。');
 portrait(heirs.map(p=>p.name).filter(Boolean).join('、'),168,77,153,44,{size:15,align:'left',label:'立協議書人姓名'});
 portrait(deceased.name,432,77,93,44,{size:15,label:'被繼承人姓名'});
 date(dateParts(m.deathDate),[808,853,897],78,42);
 lands.forEach((p,i)=>{
  const y=257+i*67.4;
  const values=[p.district,p.section,p.subsection,p.number,p.area,p.share,p.allocation],xs=[78,156,233,296,472,592,734,938];
  values.forEach((value,j)=>portrait(value,xs[j],y,xs[j+1]-xs[j],67.4,{size:18,label:j===6?'遺產權利人及繼承持分':'遺產土地標示'}));
 });
 buildings.forEach((p,i)=>{
  const y=679+i*99.7;
  portrait(p.district,78,y,78,99.7,{size:18,label:'建物行政區'});
  [[p.section,156,77],[p.subsection,233,63],[p.number,296,176]].forEach(([value,x,w])=>portrait(value,x,y,w,68,{size:18,label:'遺產建物標示'}));
  portrait(p.address,197,y+68,275,31.7,{size:13,align:'left',label:'建物門牌'});
  [[p.area,472,120],[p.share,592,142],[p.allocation,734,204]].forEach(([value,x,w])=>portrait(value,x,y,w,99.7,{size:18,label:x===734?'遺產權利人及繼承持分':'遺產建物面積／持分'}));
 });
 // All four 立協議書人 signature lines are deliberately left blank.
 date(dateParts(m.contractDate),[503,591,679],1331,42);
 return true;
}
