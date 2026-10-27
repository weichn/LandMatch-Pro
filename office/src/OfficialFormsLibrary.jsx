import {useMemo,useRef,useState} from 'react';
import {officialFormsCatalog} from './officialFormsCatalog';
import RegistrationPreview,{downloadPdf,openPrintablePdf} from './RegistrationPreview';
import {applyPrintLayout,paperLayouts} from './printLayout';
import './official-forms-library.css';

function caseTemplateFor(form){
 const name=form.label;
 if(form.variant!=='blank')return '';
 if(/土地登記申請書/.test(name))return /買賣|贈與|繼承|抵押權設定|登記類申請書表/.test(form.context)?'application':'';
 if(/贈與.*移轉契約書/.test(name))return 'gift';
 if(/買賣.*移轉契約書/.test(name))return 'sale';
 if(/抵押權設定契約書/.test(name))return 'mortgage';
 if(/繼承系統表/.test(name))return 'inheritance-tree';
 if(/遺產分割協議書/.test(name))return 'inheritance-partition';
 return '';
}
const variantNames={blank:'空白書表',example:'填寫範例',instructions:'填寫說明'};
export default function OfficialFormsLibrary({onUseTemplate}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[variant,setVariant]=useState('blank');
 const [selected,setSelected]=useState(null),[bytes,setBytes]=useState(null),[layout,setLayout]=useState('original'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const revision=useRef(0);
 const categories=[...new Set(officialFormsCatalog.forms.map(f=>f.category))];
 const rows=useMemo(()=>officialFormsCatalog.forms.filter(f=>(!category||f.category===category)&&(!variant||f.variant===variant)&&(!query||[f.label,f.context,f.provider].join(' ').includes(query.trim()))),[query,category,variant]);
 async function preview(form,paper=layout){
  const current=++revision.current;setSelected(form);setBytes(null);setError('');setBusy(true);
  try{
   if(!form.localFile)throw new Error('此版本請使用下方官方原檔連結下載。');
   const response=await fetch('/forms/'+form.localFile);
   if(!response.ok)throw new Error('官方書表讀取失敗，請重試或下載官方原檔。');
   const output=await applyPrintLayout(new Uint8Array(await response.arrayBuffer()),paper);
   if(current===revision.current)setBytes(output);
  }catch(e){if(current===revision.current)setError(e.message||'預覽未完成，請使用官方原檔。');}
  finally{if(current===revision.current)setBusy(false);}
 }
 return <section className="official-forms-library">
  <h3>官方書表庫</h3>
  <p>完整收錄下列官方目錄的書表，涵蓋登記、贈與、繼承、分割、信託、測量、謄本與其他申請；不同機關版本分開列示。</p>
  <div className="document-source">{officialFormsCatalog.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.provider}官方目錄 ↗</a>)}</div>
  <div className="forms-library-filters">
   <label>搜尋書表<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：贈與、繼承、信託、測量"/></label>
   <label>類別<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">全部類別</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>文件種類<select value={variant} onChange={e=>setVariant(e.target.value)}><option value="">全部種類</option>{Object.entries(variantNames).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
  </div>
  <p className="form-note">找到 {rows.length} 項（含機關及情境版本）。案件套印版採新竹市地政事務所官方範本；其他書表可下載各機關原檔編輯或列印。</p>
  <div className="forms-library-list">{rows.map(form=><article className="forms-library-item" key={form.id}>
   <div><h4>{form.label}</h4><p>{form.context} · {form.provider} · {variantNames[form.variant]}</p>{form.notes?.map((note,i)=><p key={i}>{note}</p>)}</div>
   <div className="document-inline-actions">
    {caseTemplateFor(form)&&<button type="button" onClick={()=>onUseTemplate(caseTemplateFor(form),form.context)}>使用案件套印版</button>}
    {form.localFile&&<button type="button" disabled={busy} onClick={()=>preview(form)}>預覽{form.variant==='blank'?'空白表':'文件'}</button>}
    {form.pdfUrl&&<a href={form.pdfUrl} target="_blank" rel="noreferrer">官方 PDF ↗</a>}
    {form.odtUrl&&<a href={form.odtUrl} target="_blank" rel="noreferrer">下載 ODT ↗</a>}
    {form.docUrl&&<a href={form.docUrl} target="_blank" rel="noreferrer">下載 Word ↗</a>}
    {form.otherUrls?.map(item=><a href={item.url} key={item.url} target="_blank" rel="noreferrer">下載 {item.format.toUpperCase()} ↗</a>)}
    {!form.pdfUrl&&!form.odtUrl&&!form.docUrl&&<a href={form.sourceUrl} target="_blank" rel="noreferrer">至官方目錄查看 ↗</a>}
   </div>
  </article>)}</div>
  {!rows.length&&<p role="status">沒有符合的書表，請改用其他關鍵字或切換類別。</p>}
  {selected&&<section className="forms-library-preview">
   <h3>{selected.label}｜{variantNames[selected.variant]}</h3>
   <p className="form-note">這是官方{variantNames[selected.variant]}，尚未填入本案資料。印製、附件及簽章請依受理機關要求核對。</p>
   <label>書表庫列印版型<select disabled={busy} value={layout} onChange={e=>{setLayout(e.target.value);void preview(selected,e.target.value);}}>{paperLayouts.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
   <div className="document-inline-actions">{bytes&&<><button onClick={()=>downloadPdf(bytes,`${selected.label}-${layout==='a3'?'A3直式':'原版'}.pdf`).catch(e=>setError(e.message))}>下載書表 PDF</button><button onClick={()=>openPrintablePdf(bytes).catch(e=>setError(e.message))}>開啟書表列印 PDF</button></>}</div>
   <RegistrationPreview bytes={bytes} busy={busy} error={error} title={selected.label+'｜'+variantNames[selected.variant]}/>
  </section>}
 </section>;
}
