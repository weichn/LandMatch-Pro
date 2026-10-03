import {useEffect,useRef,useState} from 'react';
import {db} from './client';
import {RecordEditor,RelationField} from './OfficeApp';
import {errorText} from './model';

export default function SaleParties({officeId,caseId,canWrite}){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [role,setRole]=useState('buyer'),[contactId,setContactId]=useState(''),[creating,setCreating]=useState(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
 const pending=useRef(false);
 useEffect(()=>{
  const abort=new AbortController();
  db.from('office_case_parties').select('id,contact_id,role,contacts(display_name,phone,address)').eq('office_id',officeId).eq('case_id',caseId).order('created_at').abortSignal(abort.signal)
   .then(({data,error})=>{if(!abort.signal.aborted){setRows(data||[]);setLoadError(error?'無法讀取當事人，請重試。':'');setLoading(false);}})
   .catch(()=>{if(!abort.signal.aborted){setLoadError('當事人讀取連線失敗，請重試。');setLoading(false);}});
  return()=>abort.abort();
 },[officeId,caseId,revision]);
 function refresh(){setLoading(true);setRevision(v=>v+1);}
 async function add(e){
  e.preventDefault();if(!canWrite||!contactId||pending.current)return;
  pending.current=true;setBusy(true);setError('');setMessage('');
  try{
   const {data,error}=await db.from('office_case_parties').insert({office_id:officeId,case_id:caseId,contact_id:contactId,role}).select('id');
   if(error&&error.code!=='23505')throw error;
   if(!error&&data?.length!==1)throw new Error('no row');
   setMessage(error?'這位聯絡人已在此角色中，沒有重複新增。':'已加入'+(role==='buyer'?'買受人':'出賣人')+'。');setContactId('');refresh();
  }catch(e){setError(errorText(e));}finally{pending.current=false;setBusy(false);}
 }
 async function remove(row){
  if(!canWrite||pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');
  try{const {data,error}=await db.from('office_case_parties').delete().eq('id',row.id).eq('office_id',officeId).eq('case_id',caseId).select('id');if(error)throw error;if(data?.length!==1){setError('角色已被修改或權限已變更，請重新讀取。');refresh();return;}setMessage('已移除此案件角色，聯絡人名冊仍保留。');refresh();}
  catch(e){setError(errorText(e));}finally{pending.current=false;setBusy(false);}
 }
 return <section><h2>買受人／出賣人</h2><p className="form-note">分別加入本案買賣雙方，可加入多人。謄本遮蔽姓名不會自動認定為出賣人；主要聯絡人也不會自動成為當事人。此處只設定角色，持分與正式書表尚未開放。</p>
 <button type="button" disabled={busy} onClick={refresh}>重新讀取當事人</button>
 {loading?<p role="status">讀取當事人中…</p>:loadError?<p className="notice error" role="alert">{loadError}</p>:['buyer','seller'].map(r=><section key={r}><h3>{r==='buyer'?'買受人':'出賣人'}（{rows.filter(x=>x.role===r).length} 人）</h3>{rows.filter(x=>x.role===r).length?rows.filter(x=>x.role===r).map(row=><div className="settings-card" key={row.id}><strong>{row.contacts?.display_name||'聯絡人資料無法讀取'}</strong><p>{row.contacts?.phone||'尚無電話'} · {row.contacts?.address||'尚無地址'}</p>{canWrite&&<button type="button" disabled={busy} onClick={()=>remove(row)}>移除{r==='buyer'?'買受人':'出賣人'}角色：{row.contacts?.display_name||'聯絡人'}</button>}</div>):<p>尚未加入{r==='buyer'?'買受人':'出賣人'}。</p>}</section>)}
 {canWrite&&<form onSubmit={add}><fieldset disabled={busy||!!creating||loading||!!loadError} className="form-grid"><label>加入角色<select value={role} onChange={e=>setRole(e.target.value)}><option value="buyer">買受人</option><option value="seller">出賣人</option></select></label><RelationField kind="contacts" value={contactId} onChange={setContactId} officeId={officeId} disabled={busy||loading||!!loadError} label="案件當事人" revision={revision} onCreate={name=>setCreating({display_name:name})}/><button className="primary" disabled={!contactId||busy}>加入{role==='buyer'?'買受人':'出賣人'}</button></fieldset></form>}
 {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
 {creating&&<RecordEditor table="contacts" row={creating} officeId={officeId} canWrite={canWrite} quick onClose={()=>setCreating(null)} onSaved={row=>{setContactId(row.id);setCreating(null);setRevision(v=>v+1);setMessage('聯絡人已建立並選取，請按加入角色。');}}/>}
 </section>;
}
