import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
const TranscriptImport = lazy(() => import('./TranscriptImport'));
const CaseTranscripts = lazy(() => import('./CaseTranscripts'));
import { db } from './client';
import { definitions, statusLabels, roleLabels, caseTypes, payloadFor, errorText } from './model';

const marketplace = 'https://land-match-pro.vercel.app/';
function Notice({ children, error = false }) {
 return children ? <div className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>{children}</div> : null;
}
function Brand() { return <a className="brand" href="/"><span className="brand-mark">L.</span><span>LandMatch <b>Office</b><small>事務所工作台</small></span></a>; }

export default function OfficeApp() {
 const [auth, setAuth] = useState({ ready:false, session:null, error:'' });
 useEffect(() => {
  let active=true;
  const { data:{ subscription } }=db.auth.onAuthStateChange((_event,session)=>{
   if(active) setAuth({ready:true,session,error:''});
  });
  db.auth.getSession().then(({data,error})=>{
   if(active) setAuth({ready:true,session:data.session,error:error ? '無法確認登入狀態，請重新整理。' : ''});
  }).catch(()=>{if(active)setAuth({ready:true,session:null,error:'無法確認登入狀態，請重新整理。'});});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 return <div className="office-app"><header className="topbar"><Brand/><a className="back-link" href={marketplace}>返回媒合平台 ↗</a></header>
 {!auth.ready ? <main className="loading" role="status">正在確認登入狀態…</main> : auth.error ? <main><Notice error>{auth.error}</Notice></main> : auth.session ? <Workspace key={auth.session.user.id} user={auth.session.user}/> : <AuthScreen/>}
 <footer className="site-footer">LandMatch Pro Office <span>讓案件有條理，讓辦案更專注。</span></footer></div>;
}
function AuthScreen() {
 const [mode,setMode]=useState('login');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const pending=useRef(false);
 async function submit(event) {
  event.preventDefault();if(pending.current)return;
  pending.current=true;setBusy(true);setMessage('');setError('');
  const form=new FormData(event.currentTarget);
  try {
   const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
   const result=mode==='signup' ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
   if(result.error) {
    setError(mode==='login' ? '登入未完成，請確認 Email、密碼及信箱驗證狀態。' : '註冊未完成，請確認密碼長度或稍後重試。');
   } else if(mode==='signup' && !result.data.session) {
    setMessage('請至信箱完成驗證，再回到此工作台登入。若已有帳號，請直接登入。');
   }
  } catch {setError('連線失敗，請稍後重試。');}
  finally{pending.current=false;setBusy(false);}
 }
 return <main className="welcome"><section className="welcome-copy"><div className="eyebrow">YOUR OFFICE, IN ORDER</div><h1>每一件委託，<br/>都有清楚的下一步。</h1><p>把案件、聯絡人與往來組織，<br/>整理在事務所專屬的工作空間。</p><div className="feature-row"><span>01<br/><strong>案件進度</strong></span><span>02<br/><strong>聯絡人管理</strong></span><span>03<br/><strong>組織資料</strong></span></div><div className="welcome-note">專屬事務所空間 · 依成員權限存取</div></section>
 <section className="auth-card"><div className="eyebrow">LANDMATCH OFFICE</div><h2>{mode==='login'?'登入工作台':'建立 Office 帳號'}</h2><p>Office 使用獨立登入，請使用工作台帳號。</p>
 <form onSubmit={submit}><label>Email<input type="email" name="email" required autoComplete="email" maxLength={254}/></label><label>密碼<input type="password" name="password" required minLength={mode==='signup'?12:1} autoComplete={mode==='signup'?'new-password':'current-password'}/></label>{mode==='signup'&&<small>請使用至少 12 個字元的密碼；若收到驗證信，請依信件指示完成驗證。</small>}
 <Notice error>{error}</Notice><Notice>{message}</Notice><button className="primary wide" disabled={busy}>{busy?'處理中…':mode==='login'?'登入工作台 →':'註冊帳號'}</button></form>
 <button className="text-button" disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');}}>{mode==='login'?'第一次使用？建立 Office 帳號':'已有帳號？返回登入'}</button></section></main>;
}
function Workspace({user}) {
 const [memberships,setMemberships]=useState(null);
 const [officeId,setOfficeId]=useState('');
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 const [tab,setTab]=useState('office_cases');
 const [signingOut,setSigningOut]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  db.from('office_members').select('id,office_id,role,offices(id,name,phone,email,address,updated_at)').eq('user_id',user.id).eq('status','active').order('created_at').abortSignal(controller.signal)
   .then(({data,error})=>{
    if(controller.signal.aborted)return;
    if(error){setError(errorText(error));setMemberships(null);return;}
    setError('');setMemberships(data);
    setOfficeId(current=>data.some(m=>m.office_id===current)?current:data[0]?.office_id||'');
   }).catch(()=>{if(!controller.signal.aborted)setError('讀取事務所失敗，請重試。');});
  return ()=>controller.abort();
 },[user.id,revision]);
 async function logout(){
  setSigningOut(true);
  try{const {error}=await db.auth.signOut({scope:'local'});if(error)setError('登出未完成，請重試。');}
  catch{setError('登出未完成，請重試。');}finally{setSigningOut(false);}
 }
 const membership=memberships?.find(m=>m.office_id===officeId);
 return <div className="workspace"><aside className="sidebar"><div className="sidebar-label">我的事務所</div>
 {memberships?.length>0&&<label className="office-switch"><span className="sr-only">切換事務所</span><select value={officeId} onChange={e=>setOfficeId(e.target.value)}>{memberships.map(m=><option key={m.id} value={m.office_id}>{m.offices?.name||'事務所'}</option>)}</select></label>}
 <nav aria-label="工作台功能">{[['import','↥','謄本匯入'],['office_cases','▤','案件管理'],['contacts','◎','聯絡人'],['organizations','▦','往來組織'],['settings','⚙','事務所設定']].map(([id,icon,label])=><button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}><span>{icon}</span>{label}</button>)}</nav>
 <div className="user-panel"><span className="role-badge">{roleLabels[membership?.role]||'Office 帳號'}</span><p>{user.email}</p><button className="text-button" onClick={logout} disabled={signingOut}>{signingOut?'登出中…':'登出工作台'}</button></div></aside>
 <main className="workspace-main"><Notice error>{error}</Notice>{error&&<button onClick={()=>setRevision(v=>v+1)}>重試讀取</button>}
 {!memberships&&!error&&<p role="status">讀取事務所中…</p>}
 {memberships?.length===0&&<Onboarding onCreated={()=>setRevision(v=>v+1)}/>}
 {membership && (tab==='import'?<Suspense fallback={<p>載入謄本匯入…</p>}><TranscriptImport key={officeId}/></Suspense>:tab==='settings'?<Settings key={officeId} membership={membership} onSaved={()=>setRevision(v=>v+1)}/>:<Records key={officeId+tab} table={tab} membership={membership}/>)}
 </main></div>;
}
function Onboarding({onCreated}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const pending=useRef(false);
 async function submit(e){
  e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');
  const name=new FormData(e.currentTarget).get('name').trim();
  try{const {error}=await db.rpc('office_create',{p_name:name});if(error)setError(errorText(error));else onCreated();}
  catch{setError('建立未完成，請重試；重複提交不會重複建立事務所。');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="onboarding"><div className="eyebrow">WELCOME TO YOUR OFFICE</div><h1>從你的事務所開始。</h1><p>建立工作空間後，即可整理案件、建立聯絡人與往來組織。</p><form onSubmit={submit}><label>事務所名稱<input name="name" placeholder="例如：桓宸地政士事務所" required maxLength={200}/></label><Notice error>{error}</Notice><button className="primary" disabled={busy}>{busy?'建立中…':'建立我的事務所 →'}</button></form><small>使用已登入的 Office 帳號建立。若你已有成員資格或帳號被停權，請聯絡事務所管理員。</small></section>;
}
function Records({table,membership}) {
 const def=definitions[table], officeId=membership.office_id;
 const canWrite=['owner','admin','staff'].includes(membership.role), canDelete=['owner','admin'].includes(membership.role);
 const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
 const [transcriptCase,setTranscriptCase]=useState(null);
 const [editor,setEditor]=useState(null),[deleting,setDeleting]=useState(null),[message,setMessage]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(0);},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{
  const controller=new AbortController();
  let request=db.from(table).select(def.columns,{count:'exact'}).eq('office_id',officeId).order('updated_at',{ascending:false}).order('id').range(page*20,page*20+19);
  if(query)request=request.ilike(def.name,'%'+query.replace(/[\\%_]/g,'\\$&')+'%');
  request.abortSignal(controller.signal).then(({data,error,count})=>{
   if(controller.signal.aborted)return;
   setLoading(false);
   if(error){setRows([]);setError(errorText(error));return;}
   setRows(data);setTotal(count||0);setError('');
   if(!data.length&&page>0)setPage(p=>p-1);
  }).catch(()=>{if(!controller.signal.aborted){setLoading(false);setError('讀取失敗，請重試。');}});
  return ()=>controller.abort();
 },[table,def.columns,def.name,officeId,page,query,revision]);
 function refresh(text){setMessage(text);setLoading(true);setRevision(v=>v+1);}
 return <><div className="page-heading"><div><div className="eyebrow">OFFICE / {table==='office_cases'?'CASES':table==='contacts'?'CONTACTS':'ORGANIZATIONS'}</div><h1>{def.label}管理</h1><p>{table==='office_cases'?'每件委託的進度，都在這裡。':table==='contacts'?'建立聯絡資料，讓每一次聯繫都有依據。':'集中管理銀行、仲介與合作單位。'}</p></div>{canWrite&&<button className="primary" onClick={()=>setEditor({})}>＋ 新增{def.label}</button>}</div>
 <div className="list-toolbar"><label className="search"><span className="sr-only">搜尋{def.label}名稱</span><input value={search} onChange={e=>{setSearch(e.target.value);setLoading(e.target.value.trim()!==query);}} placeholder={'搜尋'+def.label+'名稱…'} maxLength={100}/></label><span>{loading?'讀取中…':total+' 筆資料'}</span><button className="quiet" onClick={()=>refresh('')}>重新整理</button></div>
 <Notice error>{error}</Notice><Notice>{message}</Notice>
 {loading?<div className="empty" role="status">讀取資料中…</div>:!rows.length?<div className="empty"><span className="empty-symbol">{table==='office_cases'?'▤':'◎'}</span><h2>{query?'沒有符合的結果':'尚未建立'+def.label}</h2><p>{query?'試試其他名稱。':canWrite?'從新增第一筆資料開始，逐步整理你的事務所。':'目前沒有可檢視的資料。'}</p>{canWrite&&!query&&<button onClick={()=>setEditor({})}>新增{def.label}</button>}</div>:
 <div className="table-wrap"><table><thead><tr>{table==='office_cases'&&<th>案號</th>}<th>{def.label}名稱</th><th>{table==='office_cases'?'進度':'電話'}</th><th>{table==='office_cases'?'類型':'Email'}</th><th>更新日期</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{table==='office_cases'&&<td className="case-number">{row.case_number}</td>}<td><button className="record-name" onClick={()=>setEditor(row)}>{row[def.name]}</button></td><td>{table==='office_cases'?<span className={'status '+row.status}>{statusLabels[row.status]}</span>:row.phone||'—'}</td><td>{table==='office_cases'?row.case_type:row.email||'—'}</td><td>{new Date(row.updated_at).toLocaleDateString('zh-TW')}</td><td>{table==='office_cases'&&<button className="text-button" onClick={()=>setTranscriptCase(row)}>地籍資料</button>}{canDelete&&<button className="text-button danger" onClick={()=>setDeleting(row)} aria-label={'刪除'+row[def.name]}>刪除</button>}</td></tr>)}</tbody></table></div>}
 <div className="pagination"><button disabled={page===0||loading} onClick={()=>{setLoading(true);setPage(p=>p-1);}}>上一頁</button><span>第 {page+1} 頁</span><button disabled={(page+1)*20>=total||loading} onClick={()=>{setLoading(true);setPage(p=>p+1);}}>下一頁</button></div>
 {editor&&<RecordEditor table={table} row={editor} officeId={officeId} canWrite={canWrite} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);refresh('資料已儲存。');}}/>}
 {transcriptCase&&<Modal title={transcriptCase.case_number+"｜案件地籍資料"} onClose={()=>setTranscriptCase(null)}><Suspense fallback={<p>載入案件資料…</p>}><CaseTranscripts officeId={officeId} caseId={transcriptCase.id}/></Suspense></Modal>}
 {deleting&&<DeleteDialog table={table} row={deleting} officeId={officeId} onClose={()=>setDeleting(null)} onDeleted={()=>{setDeleting(null);refresh('資料已刪除。');}}/>}
 </>;
}
function Modal({title,children,onClose,busy=false}) {
 const ref=useRef(null),titleId=useId();
 useEffect(()=>{const el=ref.current;el.showModal();return()=>el.close();},[]);
 return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="modal-header"><h2 id={titleId}>{title}</h2><button aria-label="關閉" disabled={busy} onClick={onClose}>✕</button></div>{children}</dialog>;
}
function RelationField({kind,value,onChange,officeId,disabled,label,onCreate,revision=0}) {
 const [search,setSearch]=useState(''),[options,setOptions]=useState([]),[error,setError]=useState(''),[selected,setSelected]=useState(null);
 const [loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[selectedError,setSelectedError]=useState(false);
 const name=definitions[kind].name;
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   let q=db.from(kind).select('id,'+name).eq('office_id',officeId).order(name).limit(50);
   if(search.trim())q=q.ilike(name,'%'+search.trim().replace(/[\\%_]/g,'\\$&')+'%');
   q.abortSignal(controller.signal).then(({data,error})=>{
    if(!controller.signal.aborted){setLoading(false);setOptions(data||[]);setError(error?'無法讀取選項，請稍後重試。':'');}
   }).catch(()=>{if(!controller.signal.aborted){setLoading(false);setError('連線失敗，請重新讀取選項。');}});
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[kind,name,officeId,search,revision,retry]);
 useEffect(()=>{
  if(!value)return;
  const controller=new AbortController();
  db.from(kind).select('id,'+name).eq('office_id',officeId).eq('id',value).maybeSingle().abortSignal(controller.signal).then(({data,error})=>{if(!controller.signal.aborted){setSelected(data);setSelectedError(!!error||!data);}}).catch(()=>{if(!controller.signal.aborted)setSelectedError(true);});
  return()=>controller.abort();
 },[kind,name,officeId,value,retry]);
 const items=selected && selected.id===value && !options.some(o=>o.id===value)?[selected,...options]:options;
 return <div className="relation"><label>搜尋{label}<input disabled={disabled} value={search} onChange={e=>{setSearch(e.target.value);setLoading(true);}} placeholder="輸入名稱縮小選項（最多顯示 50 筆）"/></label><label>{label}<select value={value||''} onChange={e=>{setSelectedError(false);onChange(e.target.value);}} disabled={disabled}><option value="">未指定</option>{value&&!items.some(o=>o.id===value)&&<option value={value}>{selectedError?'已選資料無法讀取（保留原選擇）':'已選資料（讀取中）'}</option>}{items.map(item=><option key={item.id} value={item.id}>{item[name]}</option>)}</select></label>{loading?<small role="status">讀取選項中…</small>:!error&&!options.length&&<small>{search.trim()?'沒有符合搜尋的資料。':'尚未建立'+definitions[kind].label+'，可直接在此新增。'}</small>}<Notice error>{error}</Notice>{(error||selectedError)&&<button type="button" disabled={disabled} onClick={()=>{setLoading(true);setRetry(v=>v+1);}}>重新讀取選項</button>}{onCreate&&!disabled&&<button type="button" onClick={()=>onCreate(search.trim())}>＋ 新增{definitions[kind].label}</button>}</div>;
}
export function RecordEditor({table,row,officeId,canWrite,onClose,onSaved,quick=false}) {
 const def=definitions[table];const [form,setForm]=useState({...row,status:row.status||'draft',case_type:row.case_type||''});
 const [creating,setCreating]=useState(null),[relationRevision,setRelationRevision]=useState(0),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function submit(e){
  e.preventDefault();if(!canWrite||pending.current)return;pending.current=true;setBusy(true);setError('');
  try {
   if(table==='office_cases'&&form.closed_on&&(!form.opened_on||form.closed_on<form.opened_on)){setError('結案日期不得早於開案日期，且須填寫開案日期。');return;}
   const values=payloadFor(table,form);
   const request=row.id?db.from(table).update(values).eq('id',row.id).eq('office_id',officeId).eq('updated_at',row.updated_at):db.from(table).insert({...values,office_id:officeId});
   const {data,error}=await request.select('id');
   if(error)setError(errorText(error));
   else if(data.length!==1)setError('資料已被修改，或你的權限已變更。請關閉視窗並重新整理。');
   else onSaved({...values,id:data[0].id});
  }catch{setError('儲存未完成，請稍後重試。');}finally{pending.current=false;setBusy(false);}
 }
 return <><Modal title={(row.id?(canWrite?'編輯':'檢視'):'新增')+def.label} onClose={onClose} busy={busy||!!creating}><form onSubmit={submit}><fieldset disabled={busy||!canWrite||!!creating} className="form-grid">
 {def.fields.map(([key,label,type,max,required])=>['contacts','organizations'].includes(type)?<RelationField key={key} kind={type} value={form[key]} onChange={v=>update(key,v)} officeId={officeId} disabled={busy||!canWrite} label={label} revision={relationRevision} onCreate={canWrite?name=>setCreating({key,table:type,row:{[definitions[type].name]:name}}):null}/>:<label key={key}>{label}{required&&' *'}{type==='caseType'?<select required value={form[key]} onChange={e=>update(key,e.target.value)}><option value="">請選擇案件類型</option>{form[key]&&!caseTypes.includes(form[key])&&<option value={form[key]}>{form[key]}（原案件類型）</option>}{caseTypes.map(v=><option key={v} value={v}>{v}</option>)}</select>:type==='status'?<select value={form[key]||'draft'} onChange={e=>update(key,e.target.value)}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<input type={type} value={form[key]||''} required={required} maxLength={max} onChange={e=>update(key,e.target.value)}/>}</label>)}</fieldset>
 {table==='contacts'&&<p className="form-note">本階段只管理聯絡資訊，請勿在姓名、地址等欄位填入身分證字號。</p>}
 {quick&&<p className="form-note">儲存後會加入事務所名冊並自動選取。即使稍後取消案件，這筆名冊資料仍會保留。</p>}
 {table==='office_cases'&&<p className="form-note">主要聯絡人是聯繫窗口，不等同買受人或出賣人。</p>}
 <Notice>{message}</Notice><Notice error>{error}</Notice><div className="form-actions"><button type="button" disabled={busy||!!creating} onClick={onClose}>關閉</button>{canWrite&&<button className="primary" disabled={busy||!!creating}>{busy?'儲存中…':'儲存'+def.label}</button>}</div></form></Modal>{creating&&<RecordEditor table={creating.table} row={creating.row} officeId={officeId} canWrite={canWrite} quick onClose={()=>setCreating(null)} onSaved={saved=>{update(creating.key,saved.id);setMessage('已新增並選取「'+saved[definitions[creating.table].name]+'」，請繼續儲存'+def.label+'。');setRelationRevision(v=>v+1);setCreating(null);}}/>}</>;
}
function DeleteDialog({table,row,officeId,onClose,onDeleted}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 async function remove(){
  if(pending.current)return;pending.current=true;setBusy(true);
  try{const {data,error}=await db.from(table).delete().eq('id',row.id).eq('office_id',officeId).eq('updated_at',row.updated_at).select('id');
   if(error)setError(errorText(error));else if(data.length!==1)setError('資料已被修改或權限已變更，請重新整理。');else onDeleted();
  }catch{setError('刪除未完成，請重試。');}finally{pending.current=false;setBusy(false);}
 }
 return <Modal title={'刪除'+definitions[table].label} onClose={onClose} busy={busy}><p>確定刪除「{row[definitions[table].name]}」？此操作無法復原；仍被其他資料引用時將無法刪除。</p><Notice error>{error}</Notice><div className="form-actions"><button onClick={onClose} disabled={busy}>取消</button><button className="danger-button" onClick={remove} disabled={busy}>{busy?'刪除中…':'確認刪除'}</button></div></Modal>;
}
function Settings({membership,onSaved}) {
 const office=membership.offices;const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false);
 const writable=['owner','admin'].includes(membership.role);
 async function submit(e){
  e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');
  const f=new FormData(e.currentTarget);const values=Object.fromEntries(['name','phone','email','address'].map(k=>[k,String(f.get(k)||'').trim()||null]));
  try{const {data,error}=await db.from('offices').update(values).eq('id',office.id).eq('updated_at',office.updated_at).select('id');
   if(error)setError(errorText(error));else if(data.length!==1)setError('事務所資料已變更，請重新整理後再試。');else {setMessage('事務所資料已更新。');onSaved();}
  }catch{setError('儲存未完成，請重試。');}finally{pending.current=false;setBusy(false);}
 }
 return <><div className="page-heading"><div><div className="eyebrow">OFFICE / SETTINGS</div><h1>事務所設定</h1><p>維護工作空間的基本資訊。</p></div></div><section className="settings-card"><form onSubmit={submit}><fieldset disabled={!writable||busy} className="form-grid">{[['name','事務所名稱','text',200],['phone','電話','tel',100],['email','Email','email',254],['address','地址','text',500]].map(([k,label,type,max])=><label key={k}>{label}<input name={k} type={type} defaultValue={office[k]||''} required={k==='name'} maxLength={max}/></label>)}</fieldset><Notice error>{error}</Notice><Notice>{message}</Notice>{writable&&<button className="primary" disabled={busy}>{busy?'儲存中…':'儲存設定'}</button>}</form></section><section className="settings-card"><h2>我的成員資格</h2><p>目前權限：{roleLabels[membership.role]}</p><p className="form-note">本階段尚未開放邀請成員與變更角色；需要調整時，請由受信任的管理端處理。</p></section></>;
}
