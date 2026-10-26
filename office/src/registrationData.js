import {formatBirthDate} from './birthDate.js';
import {districtCities} from './districtCities.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const blankValues = new Set(['', '(空白)', '（空白）', '空白', '(未登記)', '（未登記）', '未登記', '-', '—', '－']);
const sourceText = value => {
 const valueText = text(value);
 return blankValues.has(valueText) ? '' : valueText;
};

function reviewedFields(row) {
 const values = {};
 for (const field of Array.isArray(row?.fields) ? row.fields : []) {
  if (field?.reviewed !== true || typeof field.key !== 'string' || typeof field.value !== 'string') continue;
  if (!Object.hasOwn(values, field.key)) values[field.key] = sourceText(field.value);
 }
 return values;
}

function splitSection(value) {
 const split = /^(.*?段)(.+小段)$/.exec(value);
 return split ? {section:split[1], subsection:split[2]} : {section:value, subsection:''};
}

const counties=[...new Set(Object.values(districtCities).flat())];
const countyName=value=>text(value).replace(/台/g,'臺');
function propertyLocation(fields){
 let district=countyName(fields.district);
 const prefix=counties.find(city=>district.startsWith(city));
 if(prefix)district=district.slice(prefix.length);
 const candidates=districtCities[district]||[];
 const explicit=countyName(fields.city);
 const address=countyName(fields.address);
 const addressCity=counties.find(city=>address.startsWith(city)&&(!candidates.length||candidates.includes(city)));
 const city=explicit||prefix||addressCity||(candidates.length===1?candidates[0]:'');
 return {city,district};
}

function propertyFromSource(row, key) {
 const fields = reviewedFields(row);
 const sectionParts=splitSection(fields.section || '');
 const sectionPrefix=sectionParts.section+sectionParts.subsection;
 const rawLand=fields.land||'';
 const land=sectionPrefix&&rawLand.startsWith(sectionPrefix)?rawLand.slice(sectionPrefix.length):rawLand;
 const commons = (Array.isArray(row.common) ? row.common : []).map(reviewedFields);
 const owners=Array.isArray(row.owners)?row.owners:[];
 const ownerShares=owners.map(reviewedFields).map(owner=>({name:owner.name||'',sequence:owner.sequence||'',share:owner.share||''})).filter(owner=>owner.share);
 const originalShares=[...new Set(ownerShares.map(owner=>owner.share))];
 return {
  key, kind:row.kind, ...propertyLocation(fields), ...splitSection(fields.section || ''),
  number:fields.number || '', area:fields.area || '', address:fields.address || '', land,
  use:fields.use || '', material:fields.material || '', floors:fields.floors || '', floor:fields.floor || '',
  floorArea:fields.floorArea || '', annex:fields.annex || '', annexArea:fields.annexArea || '',
  share:owners.length===1?ownerShares[0]?.share||'':'', price:'', limitedAmount:'', foreclosure:'', originalShare:originalShares.join('；'),ownerShares,ownerCount:owners.length,
  commonNumber:commons.map(common=>common.number || '').join('\n'),
  commonArea:commons.map(common=>common.area || '').join('\n'),
  commonShare:commons.map(common=>common.share || '').join('\n')
 };
}

function birthDate(value) {
 const iso = text(value);
 const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
 if (!match) return '';
 const [,year,month,day] = match.map(Number);
 const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
 const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
 return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] ? formatBirthDate(iso) : '';
}

/** Prepare a document-only copy; prefill reviewed title shares, leaving them editable for this transaction. */
export function initialRegistrationData({caseRow, office, parties = [], transcripts = []} = {}) {
 const sourceWarnings = [];
 const properties = [];
 const knownProperties = new Map();
 const snapshots = (Array.isArray(transcripts) ? transcripts : []).map((row,index)=>({row,index,time:Date.parse(row?.created_at) || 0}))
  .sort((a,b)=>b.time-a.time || a.index-b.index);
 for (const {row:snapshot,index:snapshotIndex} of snapshots) {
  if (!Array.isArray(snapshot?.payload?.properties)) {
   sourceWarnings.push('有一筆地籍紀錄格式無法讀取，未帶入文件。');
   continue;
  }
  snapshot.payload.properties.forEach((source,index)=>{
   if (!source || !['土地','建物'].includes(source.kind)) {
    sourceWarnings.push('有一筆無法確認種類的地籍資料，未帶入文件。');
    return;
   }
   const mapped = propertyFromSource(source, `transcript-${snapshotIndex}-${index}`);
   const completeIdentity = mapped.district && mapped.section && mapped.number;
   const identity = [mapped.kind,mapped.city,mapped.district,mapped.section,mapped.subsection,mapped.number].join('|');
   if (completeIdentity && knownProperties.has(identity)) {
    const previous = knownProperties.get(identity);
    const comparable = value => JSON.stringify({...value,key:undefined});
    if (comparable(previous) !== comparable(mapped)) {
     sourceWarnings.push(`${mapped.kind} ${mapped.district}${mapped.section}${mapped.subsection} ${mapped.number} 有多筆不同核對紀錄，已採用最新一筆，請重新核對。`);
    }
    return;
   }
   if (!completeIdentity) sourceWarnings.push(`第 ${properties.length+1} 筆${mapped.kind}的行政區、段或號碼不完整，請補填核對。`);
   if ((Array.isArray(source.fields) ? source.fields : []).some(field=>field?.reviewed !== true)) {
    sourceWarnings.push(`${mapped.kind} ${mapped.number || '未填號碼'} 含未核對欄位，該欄位未帶入文件。`);
   }
   if (completeIdentity) knownProperties.set(identity,mapped);
   properties.push(mapped);
  });
 }
 const mappedParties = [];
 const seenParties = new Set();
 for (const [index,party] of (Array.isArray(parties) ? parties : []).entries()) {
  if (!party || !['buyer','seller'].includes(party.role)) continue;
  const contact = party.contacts;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
   sourceWarnings.push('一位已指定的買賣當事人資料無法讀取，請重新指定。');
   continue;
  }
  const contactKey = text(party.contact_id) || text(party.id);
  const key = `${party.role}|${contactKey || `row-${index}`}`;
  if (seenParties.has(key)) continue;
  seenParties.add(key);
  const formattedBirthDate = birthDate(contact.birth_date);
  if (contact.birth_date && !formattedBirthDate) sourceWarnings.push(`${text(contact.display_name) || '當事人'}的出生日期格式無法讀取，請重新核對。`);
  mappedParties.push({
   key, role:party.role, personType:'natural', name:text(contact.display_name), birthDate:formattedBirthDate,
   idNumber:'', address:text(contact.address), phone:text(contact.phone), share:'', debtShare:''
  });
 }
 // caseRow deliberately does not supply parties, dates, price, or transaction shares.
 void caseRow;
 return {
  office:{name:text(office?.name),phone:text(office?.phone),address:text(office?.address)},
  meta:{landOffice:'',reason:'買賣',causeDate:'',applicationDate:'',agentName:'',agentRegistration:'',agentId:'',agentPhone:'',agentAddress:'',attachments:'',notes:'',landPrice:'',buildingPrice:'',mortgageKind:'普通',mortgageRight:'',mortgageAmount:'',mortgageScope:'',mortgageConfirmed:'',repayment:'',interest:'',lateInterest:'',penalty:'',otherScope:'',otherTerms:'',contractDate:''},
  properties, parties:mappedParties, sourceWarnings:[...new Set(sourceWarnings)]
 };
}
