import {useEffect,useRef,useState} from 'react';
import {db} from './client';
import {formatBirthDate} from './birthDate';
import {initialRegistrationData} from './registrationData';
import {addressLabels,createRegistrationPdf,documentTypes,missingFields,officialCatalog,splitAddress} from './registrationPdf';
import RegistrationPreview,{downloadPdf,openPrintablePdf} from './RegistrationPreview';
import './case-documents.css';

const roleNames={buyer:'買受人',seller:'出賣人',creditor:'抵押權人',mortgagor:'設定義務人',debtor:'債務人'};
const fieldNames={city:'縣市',district:'鄉鎮市區',section:'段',subsection:'小段',number:'地號／建號',area:'總面積（㎡）',share:'本次移轉／設定持分',land:'建物坐落地號',floor:'層次',floorArea:'各層面積（可換行對應層次）',annex:'附屬建物用途',annexArea:'附屬建物面積（㎡）',limitedAmount:'本標的限定擔保金額',foreclosure:'本標的流抵約定'};
function Input({label,value,onChange,multiline=false,...props}){return <label>{label}{multiline?<textarea value={value||''} onChange={e=>onChange(e.target.value)} maxLength={1500} rows={3} {...props}/>:<input value={value||''} onChange={e=>onChange(e.target.value)} maxLength={200} {...props}/>}</label>;}
function Address({value,parts,onChange}){
 const values=parts||splitAddress(value);
 return <details className="document-address"><summary>核對住所分欄：{values.join('')||'尚未填寫'}</summary><div className="document-grid">{addressLabels.map((label,i)=><Input key={label} label={label} value={values[i]} onChange={v=>{const next=[...values];next[i]=v;onChange(next);}}/>)}</div></details>;
}
export default function CaseDocuments({officeId,caseRow,office,onDirtyChange}){
 const [loading,setLoading]=useState(true),[data,setData]=useState(null),[contacts,setContacts]=useState([]),[error,setError]=useState(''),[type,setType]=useState('application');
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[reviewed,setReviewed]=useState(false),[contactId,setContactId]=useState(''),[newRole,setNewRole]=useState('buyer'),[retry,setRetry]=useState(0);
 const pending=useRef(false),live=useRef(true),version=useRef(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false;version.current++;};},[]);
 useEffect(()=>{
  const abort=new AbortController();setLoading(true);setError('');
  Promise.all([
   db.from('office_case_parties').select('id,contact_id,role,contacts(display_name,birth_date,phone,address)').eq('office_id',officeId).eq('case_id',caseRow.id).order('created_at').abortSignal(abort.signal),
   db.from('office_case_transcripts').select('created_at,payload').eq('office_id',officeId).eq('case_id',caseRow.id).order('created_at',{ascending:false}).limit(100).abortSignal(abort.signal),
   db.from('contacts').select('id,display_name,birth_date,address,phone').eq('office_id',officeId).order('display_name').limit(200).abortSignal(abort.signal),
  ]).then(([parties,transcripts,list])=>{
   if(abort.signal.aborted)return;if(parties.error||transcripts.error||list.error)throw new Error('案件資料讀取未完成，請重試。');
   setData(initialRegistrationData({caseRow,office,parties:parties.data,transcripts:transcripts.data}));setContacts(list.data);setLoading(false);
  }).catch(e=>{if(!abort.signal.aborted){setError(e.message||'案件資料讀取失敗，請重試。');setLoading(false);}});
  return()=>abort.abort();
 },[officeId,caseRow.id,retry]); // A document session retains its own copy until closed.
 function change(fn){version.current++;setResult(null);setReviewed(false);setData(fn);onDirtyChange?.(true);}
 const meta=(key,value)=>change(d=>({...d,meta:{...d.meta,[key]:value}}));
 const property=(index,key,value)=>change(d=>({...d,properties:d.properties.map((p,i)=>i===index?{...p,[key]:value}:p)}));
 const party=(index,key,value)=>change(d=>({...d,parties:d.parties.map((p,i)=>i===index?{...p,[key]:value}:p)}));
 function addParty(){
  const c=contacts.find(c=>c.id===contactId);
  change(d=>({...d,parties:[...d.parties,{key:crypto.randomUUID(),role:newRole,personType:'natural',name:c?.display_name||'',birthDate:formatBirthDate(c?.birth_date),address:c?.address||'',phone:c?.phone||'',share:'',debtShare:'',idNumber:''}]}));setContactId('');
 }
 async function generate(){
  if(pending.current||!data)return;pending.current=true;setBusy(true);setError('');const current=version.current;
  try{const output=await createRegistrationPdf(data,type,{reviewed});if(live.current&&current===version.current)setResult(output);}
  catch(e){if(live.current)setError(e.message||'PDF 產生未完成，請重試。');}
  finally{pending.current=false;if(live.current)setBusy(false);}
 }
 if(loading)return <p role="status">讀取案件、當事人及核對地籍資料…</p>;
 if(!data)return <><p className="notice error" role="alert">{error}</p><button onClick={()=>setRetry(v=>v+1)}>重新讀取</button></>;
 const missing=missingFields(data,type),isMortgage=type==='mortgage'||(type==='application'&&data.meta.reason==='抵押權設定'),isSale=type.includes('sale'),m=data.meta;
 const selectedDef=documentTypes.find(d=>d.id===type);
 return <section className="case-documents">
  <p>官方原版書表套印。先核對標的與當事人，再補填本次登記條件，最後產生 PDF。</p>
  <p className="form-note">本視窗補填內容暫存於瀏覽器記憶體，關閉後不保留；請下載 PDF 保存。身分字號不寫入案件名冊。</p>
  <div className="document-source"><a href={officialCatalog} target="_blank" rel="noreferrer">官方書表來源與填寫說明 ↗</a><a href={'/forms/'+(type==='application'?'application.pdf':selectedDef.file)} target="_blank" rel="noreferrer">查看官方空白原檔 ↗</a></div>
  <label>選擇文件<select disabled={busy} value={type} onChange={e=>{setType(e.target.value);setResult(null);setReviewed(false);setError('');version.current++;}}>{documentTypes.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
  {data.sourceWarnings.length>0&&<div className="notice" role="status">{data.sourceWarnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
  <fieldset disabled={busy} className="document-editor">
  <h3>1. 登記標的</h3><p className="form-note">每份最多 4 筆標的；從謄本帶入的原持分僅供對照，本次移轉／設定持分須另外填寫。未勾選的資料不會列入本份文件。</p>
  {data.properties.map((p,i)=><details key={p.key} open={i===0} className="document-record"><summary>{p.kind}｜{p.district}{p.section}{p.subsection} {p.number||'新增標的'}</summary><label className="check-row"><input type="checkbox" checked={p.included!==false} onChange={e=>property(i,'included',e.target.checked)}/>列入文件</label><div className="document-grid">{['city','district','section','subsection','number','area','share',...(p.kind==='建物'?['land','floor','floorArea','annex','annexArea']:[]),...(isMortgage?['limitedAmount','foreclosure']:[])].map(k=><Input key={k} label={fieldNames[k]} value={p[k]} multiline={['floor','floorArea'].includes(k)} onChange={v=>property(i,k,v)}/>)}</div>{p.originalShare&&<p className="form-note">謄本原持分：{p.originalShare}</p>}{p.kind==='建物'&&<><p className="form-note">多層建物請在層次與各層面積逐行對應填寫，最多 4 層；共有部分須另列標的。</p><Input label="建物門牌（先帶入後請核對分欄）" value={p.address} onChange={v=>change(d=>({...d,properties:d.properties.map((a,j)=>j===i?{...a,address:v,addressParts:splitAddress(v)}:a)}))}/><Address value={p.address} parts={p.addressParts} onChange={parts=>change(d=>({...d,properties:d.properties.map((a,j)=>j===i?{...a,address:parts.join(''),addressParts:parts}:a)}))}/></>}{p.commonNumber&&<p className="form-note">謄本另有共有部分：{p.commonNumber}；面積 {p.commonArea}；原持分 {p.commonShare}。若屬本次登記標的，請另外新增建物，並核對完整標示及本次持分。</p>}</details>)}
  <div className="document-inline-actions">{['土地','建物'].map(kind=><button type="button" key={kind} onClick={()=>change(d=>({...d,properties:[...d.properties,{key:crypto.randomUUID(),kind,city:'',district:'',section:'',subsection:'',number:'',area:'',share:'',address:''}]}))}>＋ 新增{kind}標的</button>)}</div>
  <h3>2. 當事人</h3><p className="form-note">買賣文件最多 4 人；申請書連同代理人最多 6 人。抵押權文件須另外指定權利人、設定義務人及債務人，請核對每位當事人的角色。</p>
  {data.parties.map((p,i)=><details key={p.key} className="document-record" open><summary>{roleNames[p.role]}｜{p.name||'待填姓名'}</summary><label className="check-row"><input type="checkbox" checked={p.included!==false} onChange={e=>party(i,'included',e.target.checked)}/>列入相應文件</label><div className="document-grid"><label>本份文件角色<select value={p.role} onChange={e=>party(i,'role',e.target.value)}>{Object.entries(roleNames).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>當事人類型<select value={p.personType||'natural'} onChange={e=>party(i,'personType',e.target.value)}><option value="natural">自然人</option><option value="legal">法人／其他組織（出生日期免填）</option></select></label>{[['name','姓名／名稱'],...(p.personType==='legal'?[]:[['birthDate','出生年月日（民國，如 80/05/21）']]),['idNumber','統一編號／身分字號'],['share',isMortgage?'債權額比例':'買受／出賣持分'],...(isMortgage?[['debtShare','債務額比例']]:[]),['phone','電話']].map(([k,l])=><Input key={k} label={l} value={p[k]} autoComplete="off" onChange={v=>party(i,k,v)}/>)}</div><Input label="住所（填寫完整地址後請核對分欄）" value={p.address} onChange={v=>change(d=>({...d,parties:d.parties.map((a,j)=>j===i?{...a,address:v,addressParts:splitAddress(v)}:a)}))}/><Address value={p.address} parts={p.addressParts} onChange={parts=>change(d=>({...d,parties:d.parties.map((a,j)=>j===i?{...a,address:parts.join(''),addressParts:parts}:a)}))}/></details>)}
  <div className="document-grid"><label>從名冊帶入（最多顯示 200 筆，也可直接新增空白）<select value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">新增空白當事人</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label><label>新增角色<select value={newRole} onChange={e=>setNewRole(e.target.value)}>{Object.entries(roleNames).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button type="button" onClick={addParty}>＋ 加入本次文件</button></div>
  <h3>3. 登記及契約條件</h3>
  <div className="document-grid">
  {type==='application'?<><Input label="受理縣市（如 新北）" value={m.receivingCity} onChange={v=>meta('receivingCity',v)}/><Input label="地政事務所名稱（如 新莊）" value={m.landOffice} onChange={v=>meta('landOffice',v)}/><label>申請登記原因<select value={m.reason} onChange={e=>meta('reason',e.target.value)}><option>買賣</option><option>抵押權設定</option></select></label><Input label="原因發生日期（民國年/月/日）" value={m.causeDate} onChange={v=>meta('causeDate',v)}/><Input label="代理人姓名" value={m.agentName} onChange={v=>meta('agentName',v)}/><Input label="代理人出生年月日（民國年/月/日）" value={m.agentBirthDate} onChange={v=>meta('agentBirthDate',v)}/><Input label="代理人統一編號／身分字號" value={m.agentId} autoComplete="off" onChange={v=>meta('agentId',v)}/><Input label="代理人聯絡電話" value={m.agentPhone||data.office.phone} onChange={v=>meta('agentPhone',v)}/><Input label="代理人住所" value={m.agentAddress} onChange={v=>meta('agentAddress',v)}/><Input label="附繳證件（每行一項，含份數，最多 9 項）" multiline value={m.attachments} onChange={v=>meta('attachments',v)}/><Input label="備註" multiline value={m.notes} onChange={v=>meta('notes',v)}/></>:<><Input label="立約日期（民國年/月/日）" value={m.contractDate} onChange={v=>meta('contractDate',v)}/>{isSale&&<>{type==='sale'&&<Input label="買賣價款總金額（官方第 11 欄，請填土地及建物合計）" value={m.totalPrice} onChange={v=>meta('totalPrice',v)}/ >}{type==='land-sale'&&<Input label="土地買賣價款（新臺幣，可用大寫）" value={m.landPrice} onChange={v=>meta('landPrice',v)}/ >}{type==='building-sale'&&<Input label="建物買賣價款（新臺幣，可用大寫）" value={m.buildingPrice} onChange={v=>meta('buildingPrice',v)}/>}</>}{isMortgage&&<><label>抵押權種類<select value={m.mortgageKind} onChange={e=>meta('mortgageKind',e.target.value)}><option>普通</option><option>最高限額</option></select></label>{[['mortgageRight','提供擔保權利種類'],['mortgageAmount','擔保債權總金額（新臺幣）'],['mortgageScope','擔保債權種類及範圍'],...(m.mortgageKind==='最高限額'?[['mortgageConfirmed','擔保債權確定期日']]:[]),['repayment','債務清償日期'],['interest','利息（率）'],['lateInterest','遲延利息（率）'],['penalty','違約金'],['otherScope','其他擔保範圍約定']].map(([k,l])=><Input key={k} label={l} value={m[k]} onChange={v=>meta(k,v)}/>)}</>}<Input label="申請登記以外之約定事項（逐項填寫）" multiline value={m.otherTerms} onChange={v=>meta('otherTerms',v)}/></>}
  </div>
  </fieldset>
  <section className="document-output"><h3>4. 核對及輸出</h3><p className="form-note">簽名、蓋章及機關收件審核欄保留空白。請依受理機關要求核對附件、正副本、紙張與列印比例。</p>
   {missing.length>0&&<div className="notice"><p>待補填 {missing.length} 項；目前可下載帶有「待核對／待補填」標記的 PDF：</p><ul>{missing.map((label,i)=><li key={i}>{label}</li>)}</ul></div>}
   <label className="check-row"><input type="checkbox" disabled={busy||missing.length>0} checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setResult(null);version.current++;}}/>已逐欄核對身分、標的、持分、日期及本次約定，準備列印</label>
   <div className="document-inline-actions"><button className="primary" disabled={busy} onClick={generate}>{busy?'產生 PDF 中…':'產生／更新預覽'}</button>{result&&<><button disabled={busy} onClick={()=>downloadPdf(result.bytes,`${caseRow.case_number}-${selectedDef.label}${result.draft?'-待補填':''}.pdf`).catch(e=>setError(e.message))}>下載{result.draft?'待補填 ':''}PDF</button><button disabled={busy} onClick={()=>openPrintablePdf(result.bytes).catch(e=>setError(e.message))}>開啟列印 PDF</button></>}</div>
   <RegistrationPreview bytes={result?.bytes||null} busy={busy} error={error} title={selectedDef.label}/>
  </section>
 </section>;
}
