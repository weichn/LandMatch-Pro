// Pure parser: no network, database, identity inference, or hidden persistence.
export function normalize(text) {
 return text.normalize('NFKC').replace(/[ \t\u3000]+/g,' ').trim();
}
export function textItemsToLines(items) {
 const rows=[];
 for(const item of items) {
  if(!item.str?.trim())continue;
  const y=item.transform[5], x=item.transform[4];
  let row=rows.find(r=>Math.abs(r.y-y)<2);
  if(!row){row={y,items:[]};rows.push(row);}
  row.items.push({x,text:item.str});
 }
 return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' '));
}
const compact=s=>normalize(s).replace(/\s/g,'');
const value=(s,re)=>s.match(re)?.[1]||'';
const num=s=>s.replace(/[,＊*]/g,'');
export function parseTranscript(pages) {
 const result={version:1,properties:[],warnings:[],pageCount:pages.length};
 let property=null,section='',owner=null,right=null;
 function field(target,key,label,v,page,source) {
  if(!v)return;
  const existing=target.fields.find(f=>f.key===key);
  if(existing){if(existing.value!==v)result.warnings.push(`第 ${page} 頁「${label}」出現不同值，請對照原文。`);return;}
  target.fields.push({key,label,value:v,page,source,reviewed:false});
 }
 pages.forEach((page,index)=>{
  const pageNo=index+1;
  const lines=(Array.isArray(page)?page:page.split('\n')).map(normalize).filter(Boolean);
  const heading=lines.map(compact).map(l=>l.match(/^(.+?[區鄉鎮市])(.+?段(?:.+?小段)?)(\d{4,5}-\d{3,4})(地號|建號)$/)).find(Boolean);
  if(heading){
   const key=heading[1]+heading[2]+heading[3]+heading[4];
   if(property?.key!==key){
    property=result.properties.find(p=>p.key===key);
    if(!property){property={key,kind:heading[4]==='地號'?'土地':'建物',fields:[],owners:[],rights:[],common:[],pages:[]};result.properties.push(property);}
    section='';owner=null;right=null;
   }
   property.pages.push(pageNo);
   field(property,'district','行政區',heading[1],pageNo,heading[0]);
   field(property,'section','段／小段',heading[2],pageNo,heading[0]);
   field(property,'number',heading[4],heading[3],pageNo,heading[0]);
  }
  if(!property){result.warnings.push(`第 ${pageNo} 頁未辨識到地號／建號標題，未自動歸戶。`);return;}
  for(const source of lines){
   const s=compact(source);
   if(/標示部/.test(s)){section='description';owner=null;right=null;continue;}
   if(/所有權部/.test(s)){section='owners';owner=null;right=null;continue;}
   if(/他項權利部/.test(s)){section='rights';owner=null;right=null;continue;}
   if(/本謄本列印完畢|本謄本僅係/.test(s)){section='end';continue;}
   if(/列印時間:/.test(s))field(property,'issued','列印時間',value(s,/列印時間:(.+?)頁次:/),pageNo,source);
   if(section==='description'){
    const map=property.kind==='土地' ? [
     ['area','土地面積（㎡）',/^面積:[*]*([\d,.]+)平方公尺/],
     ['zone','使用分區',/使用分區:(.+?)(?:使用地類別:|$)/],
     ['category','使用地類別',/使用地類別:(.+)$/],
     ['announced','公告土地現值（元／㎡）',/公告土地現值:[*]*([\d,.]+)元/]
    ] : [
     ['address','建物門牌',/^建物門牌:(.+)$/],
     ['land','坐落地號',/^建物坐落地號:(.+)$/],
     ['use','主要用途',/^主要用途:(.+)$/],
     ['material','主要建材',/^主要建材:(.+)$/],
     ['floors','層數',/^層數:(.+?)總面積:/],
     ['area','建物總面積（㎡）',/總面積:[*]*([\d,.]+)平方公尺/],
     ['floor','層次',/^層次:(.+?)層次面積:/],
     ['floorArea','層次面積（㎡）',/層次面積:[*]*([\d,.]+)平方公尺/],
     ['completed','建築完成日期',/^建築完成日期:(.+)$/],
     ['annex','附屬建物用途',/^附屬建物用途:(.+?)面積:/],
     ['annexArea','附屬建物面積（㎡）',/^附屬建物用途:.+?面積:[*]*([\d,.]+)平方公尺/]
    ];
    for(const [key,label,re] of map)field(property,key,label,value(s,re),pageNo,source);
    const common=s.match(/^共有部分:(.+?建號)[*]*([\d,.]+)平方公尺/);
    if(common){const c={fields:[]};property.common.push(c);field(c,'number','共有部分建號',common[1],pageNo,source);field(c,'area','共有部分總面積（㎡）',common[2],pageNo,source);}
    if(/^權利範圍:/.test(s)&&property.common.length)field(property.common.at(-1),'share','共有部分權利範圍',value(s,/權利範圍:([^\n]+)/).replace(/\*/g,''),pageNo,source);
   }
   if(section==='owners'){
    if(/^\(\d+\)登記次序:/.test(s)){owner={fields:[]};property.owners.push(owner);field(owner,'sequence','所有權登記次序',value(s,/登記次序:(\d+)/),pageNo,source);}
    if(owner){
     field(owner,'name','所有權人',value(s,/^所有權人:(.+)$/),pageNo,source);
     field(owner,'address','所有權人住址',value(s,/^住址:(.+)$/),pageNo,source);
     field(owner,'share','所有權權利範圍',value(s,/^權利範圍:(.+)$/).replace(/\*/g,''),pageNo,source);
     field(owner,'registered','所有權登記日期',value(s,/^登記日期:(.+?)登記原因:/),pageNo,source);
     // Identity numbers are intentionally never copied into the result or export.
    }
   }
   if(section==='rights'){
    if(/^\(\d+\)登記次序:/.test(s)){right={fields:[]};property.rights.push(right);field(right,'sequence','他項權利登記次序',value(s,/登記次序:([\d-]+)/),pageNo,source);}
    if(right){
     field(right,'type','權利種類',value(s,/權利種類:(.+)$/),pageNo,source);
     field(right,'creditor','權利人',value(s,/^權利人:(.+)$/),pageNo,source);
     field(right,'amount','擔保債權總金額（元）',num(value(s,/^擔保債權總金額:新台幣[*]*([\d,]+)元/)),pageNo,source);
     field(right,'certificate','證明書字號',value(s,/^證明書字號:(.+)$/),pageNo,source);
     field(right,'jointLand','共同擔保地號',value(s,/^共同擔保地號:(.+)$/),pageNo,source);
     field(right,'jointBuilding','共同擔保建號',value(s,/^共同擔保建號:(.+)$/),pageNo,source);
    }
   }
  }
 });
 for(const p of result.properties){
  for(const o of p.owners){
   if(o.fields.some(f=>f.key==='name'&&/[*＊]/.test(f.value)))result.warnings.push(`${p.kind}所有權人姓名已遮蔽，不能據此確定完整客戶身分。`);
   if(!o.fields.some(f=>f.key==='address'))result.warnings.push(`${p.kind}所有權人住址未從文字層讀出，請查看原頁；缺漏不代表原文空白。`);
  }
  if(!p.fields.some(f=>f.key==='area'))result.warnings.push(`${p.kind}面積未辨識，請人工核對。`);
 }
 result.warnings.push('本版讀取 PDF 文字層；掃描影像、戶籍謄本與影像內文字尚未完成辨識。所有欄位均須核對。','土地、建物的共同擔保可能是同一筆權利；未自動加總抵押金額，也不代表目前貸款餘額。');
 return result;
}
export function allFields(result){return result.properties.flatMap(p=>[...p.fields,...[...p.owners,...p.common,...p.rights].flatMap(r=>r.fields)]);}
