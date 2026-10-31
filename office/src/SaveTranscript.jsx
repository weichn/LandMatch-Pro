import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {db} from './client';
import {toStoragePayload} from './transcriptDraft';
import CaseTranscripts from './CaseTranscripts';

export default function SaveTranscript({result}){
 const [session,setSession]=useState(undefined),[members,setMembers]=useState([]),[officeId,setOfficeId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[retry,setRetry]=useState(0);
 const [legacyLogin,setLegacyLogin]=useState(false);
 const pending=useRef(false);
 const mounted=useRef(false),sessionReadRevision=useRef(0),sessionUserId=useRef(undefined);
 const adoptSession=useCallback(next=>{
  const nextId=next?.user.id||null;
  if(sessionUserId.current!==nextId){setMembers([]);setOfficeId('');setLoaded(false);sessionUserId.current=nextId;}
  setSession(next);
 },[]);
 const validation=useMemo(()=>{try{return {payload:toStoragePayload(result),error:''};}catch(e){return {payload:null,error:e.message};}},[result]);
 useEffect(()=>{
  let active=true,seen=false;mounted.current=true;
  const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>{seen=true;sessionReadRevision.current++;if(active)adoptSession(s);});
  db.auth.getSession().then(({data,error})=>{if(active&&!seen){adoptSession(data.session);if(error)setError('登入狀態讀取失敗，請重新登入。');}}).catch(()=>{if(active&&!seen){adoptSession(null);setError('登入狀態讀取失敗。');}});
  return()=>{active=false;mounted.current=false;subscription.unsubscribe();};
 },[adoptSession]);
 useEffect(()=>{
  if(!session?.user.id)return;
  const abort=new AbortController();
  db.from('office_members').select('office_id,role,offices(name)').eq('user_id',session.user.id).eq('status','active').abortSignal(abort.signal)
   .then(({data,error})=>{if(abort.signal.aborted)return;setLoaded(true);setMembers(data||[]);setError(error?'無法讀取事務所，請重試。':'');setOfficeId(current=>data?.some(m=>m.office_id===current)?current:data?.[0]?.office_id||'');})
   .catch(()=>{if(!abort.signal.aborted){setLoaded(true);setError('無法讀取事務所，請重試。');}});
  return()=>abort.abort();
 },[session?.user.id,retry]);
 async function login(e){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');const form=e.currentTarget;const f=new FormData(form);
  try{const {error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});if(mounted.current){if(error)setError('登入失敗，請確認既有工作台帳號與密碼。');else form.reset();}}catch{if(mounted.current)setError('登入連線失敗，請重試。');}finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 async function checkSession(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  const revision=++sessionReadRevision.current;
  try{const {data,error}=await db.auth.getSession();if(mounted.current&&revision===sessionReadRevision.current){if(error)setError('登入狀態讀取失敗，請重試。');else{adoptSession(data.session);setRetry(v=>v+1);if(!data.session)setError('尚未偵測到工作台登入，請完成新分頁登入後再按一次。');}}}
  catch{if(mounted.current&&revision===sessionReadRevision.current)setError('登入狀態讀取失敗，請重試。');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const member=members.find(m=>m.office_id===officeId);
 return <section className="save-transcript"><h2>存入正式案件</h2><p>只在妳按下「確認存入」時，才會將下方核對資料傳送至所選事務所。原始 PDF 不上傳。</p>
 {error&&<p className="notice error" role="alert">{error}</p>}
 {session===undefined?<p role="status">確認登入狀態…</p>:!session?<div><p>使用地政士帳號登入即可自動開通工作台，不用另外註冊。登入會在新分頁完成，這裡的核對資料會保留。</p><div className="office-connect-actions"><a className="primary" href="/?connect=marketplace" target="_blank" rel="noopener noreferrer">使用地政士帳號登入 ↗</a><button type="button" onClick={checkSession} disabled={busy}>{busy?'確認中…':'已完成登入，重新確認'}</button></div><button type="button" className="text-button" onClick={()=>setLegacyLogin(v=>!v)} disabled={busy}>{legacyLogin?'收起既有帳號登入':'既有工作台帳號登入'}</button>{legacyLogin&&<form className="form-grid" onSubmit={login}><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>密碼<input name="password" type="password" required autoComplete="current-password"/></label><button className="primary" disabled={busy}>{busy?'登入中…':'登入既有工作台並選擇案件'}</button></form>}</div>:<>
 <p>已登入：{session.user.email}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>重新讀取事務所</button>
 {!loaded?<p role="status">讀取事務所…</p>:!members.length?<p>目前沒有可用的事務所成員資格。可<a href="/?connect=marketplace" target="_blank" rel="noopener noreferrer">另開工作台確認地政士帳號</a>，完成後回此頁重新讀取；核對資料會保留。</p>:<><label>儲存到哪間事務所<select value={officeId} onChange={e=>setOfficeId(e.target.value)}>{members.map(m=><option key={m.office_id} value={m.office_id}>{m.offices?.name||'事務所'}</option>)}</select></label>
 {validation.error?<p role="status">{validation.error}</p>:member&&['owner','admin','staff'].includes(member.role)?<SaveTarget key={session.user.id+officeId+JSON.stringify(validation.payload)} officeId={officeId} officeName={member.offices?.name} payload={validation.payload}/>:<p>目前是唯讀權限，無法存入案件。</p>}</>}
 </>}
 </section>;
}
function SaveTarget({officeId,officeName,payload}){
 const [mode,setMode]=useState('existing'),[search,setSearch]=useState(''),[cases,setCases]=useState([]),[caseId,setCaseId]=useState(''),[caseNumber,setCaseNumber]=useState(''),[title,setTitle]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[saved,setSaved]=useState(null);
 const request=useRef(null),pending=useRef(false);
 useEffect(()=>{
  const abort=new AbortController();
  const timer=setTimeout(()=>{
   let q=db.from('office_cases').select('id,case_number,title').eq('office_id',officeId).order('updated_at',{ascending:false}).limit(50);
   if(search.trim())q=q.ilike('title','%'+search.trim().replace(/[\\%_]/g,'\\$&')+'%');
   q.abortSignal(abort.signal).then(({data,error})=>{if(!abort.signal.aborted){setCases(data||[]);setLoading(false);setLoadError(error?'案件清單讀取失敗，請更改搜尋或重新讀取事務所。':'');}}).catch(()=>{if(!abort.signal.aborted){setLoading(false);setLoadError('案件清單連線失敗。');}});
  },250);
  return()=>{clearTimeout(timer);abort.abort();};
 },[officeId,search]);
 const selected=cases.find(c=>c.id===caseId);
 async function save(e){
  e.preventDefault();if(pending.current||!confirmed)return;pending.current=true;setBusy(true);setError('');
  const args={p_office_id:officeId,p_payload:payload,p_case_id:mode==='existing'?caseId:null,p_case_number:mode==='new'?caseNumber.trim():null,p_title:mode==='new'?title.trim():null};
  const signature=JSON.stringify(args);
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{
   const {data,error}=await db.rpc('office_save_transcript',{...args,p_request_id:request.current.id});
   if(error){setError(error.code==='23505'?'案號已存在，請選擇該既有案件，或使用不同案號。':error.code==='42501'?'權限或案件已變更，請重新確認事務所與案件。':error.code==='22023'||error.code==='23514'?'資料驗證未通過，請確認草稿及必填欄位。':'尚未確認儲存結果，請保留原選項重試；重試不會重複建立。');return;}
   if(!data?.record_id||!data.case_id)throw new Error('missing result');
   setSaved(data);
  }catch{setError('連線中斷，尚未確認儲存結果。請保留原選項再按一次，避免另外建立新案件。');}finally{pending.current=false;setBusy(false);}
 }
 if(saved)return <div role="status"><h3>{saved.duplicate?'資料已在案件中，未重複新增':'已存入正式案件'}</h3><p>事務所：{officeName}／案號：{saved.case_number}</p><p>以下直接從資料庫重新讀取。日後可從「案件管理」開啟此案的「地籍資料」。</p><a href="/">前往案件管理</a><CaseTranscripts officeId={officeId} caseId={saved.case_id}/></div>;
 return <form onSubmit={save}><fieldset disabled={busy} className="form-grid"><label>存入方式<select value={mode} onChange={e=>{setMode(e.target.value);setConfirmed(false);}}><option value="existing">加入既有案件</option><option value="new">建立新案件並存入</option></select></label>
 {mode==='existing'?<><label>搜尋案件名稱<input value={search} onChange={e=>{setSearch(e.target.value);setCaseId('');setConfirmed(false);setLoading(true);}} placeholder="顯示最近 50 筆，可輸入名稱搜尋"/></label><label>正式案件<select required value={caseId} onChange={e=>{setCaseId(e.target.value);setConfirmed(false);}} disabled={loading}><option value="">{loading?'讀取中…':'請選擇案件'}</option>{cases.map(c=><option key={c.id} value={c.id}>{c.case_number}｜{c.title}</option>)}</select></label>{loadError&&<p role="alert">{loadError}</p>}{!loading&&!cases.length&&!loadError&&<p>沒有符合的案件，可改選「建立新案件並存入」。</p>}</>:<><label>新案件案號<input required maxLength={100} value={caseNumber} onChange={e=>{setCaseNumber(e.target.value);setConfirmed(false);}}/></label><label>新案件名稱<input required maxLength={300} value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false);}}/></label></>}
 <p>將保存 {payload.properties.filter(p=>p.kind==='土地').length} 筆土地、{payload.properties.filter(p=>p.kind==='建物').length} 筆建物及其所有權人／權利記載。姓名遮蔽者保留謄本身分，不自動新增或合併客戶。</p>
 <label className="review-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>確認將核對資料存入「{officeName}／{mode==='new'?caseNumber||'請填案號':selected?.case_number||'請選案件'}」</label>
 <button className="primary" disabled={busy||!confirmed||(mode==='existing'&&!selected)}>{busy?'正在存入…':'確認存入正式案件'}</button></fieldset>{error&&<p className="notice error" role="alert">{error}</p>}</form>;
}
