export function taipeiToday(){
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export function parseBirthDate(raw,today=taipeiToday()){
 const text=String(raw??'').normalize('NFKC').trim();
 if(!text)return null;
 const match=/^(民前|民國)?\s*([1-9]\d{0,3})\s*[\/年.-]\s*(\d{1,2})\s*[\/月.-]\s*(\d{1,2})\s*日?$/.exec(text);
 if(!match)throw new Error('出生年月日請填民國年／月／日，例如 80/05/21；民國前請填民前1/05/21。');
 const y=match[1]==='民前'?1912-Number(match[2]):1911+Number(match[2]),m=Number(match[3]),d=Number(match[4]);
 const leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(y<1||y>9999||m<1||m>12||d<1||d>days[m-1])throw new Error('出生年月日不存在，請檢查月份、日期與閏年。');
 const iso=String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 if(iso>today)throw new Error('出生年月日不能晚於今天。');
 return iso;
}
export function formatBirthDate(iso){
 if(!iso)return '';
 const [y,m,d]=iso.split('-');const year=Number(y);
 return (year>=1912?String(year-1911):'民前'+(1912-year))+'/'+m+'/'+d;
}
