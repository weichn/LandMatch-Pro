import {useEffect,useState} from 'react';
import {db} from './client';
import {fieldLabels} from './transcriptDraft';
import './transcript.css';

export function StoredTranscript({payload}){
 function group(label,row,i){return <section key={label+i}><h4>{label}</h4><dl className="stored-fields">{row.fields.map(f=><div key={f.key}><dt>{fieldLabels[f.key]||f.key}</dt><dd>{f.value}<small>來源第 {f.page} 頁</small></dd></div>)}</dl></section>;}
 return payload.properties.map((p,i)=><article className="stored-property" key={i}><h3>{p.kind}｜{p.fields.find(f=>f.key==='number')?.value}</h3>{group('標示資料',p,0)}{p.owners.map((r,j)=>group(`所有權人 ${j+1}`,r,j))}{p.common.map((r,j)=>group(`共有部分 ${j+1}`,r,j))}{p.rights.map((r,j)=>group(`他項權利 ${j+1}`,r,j))}</article>);
}
export default function CaseTranscripts({officeId,caseId}){
 const [state,setState]=useState({loading:true,rows:[],error:''}),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  db.from('office_case_transcripts').select('id,created_at,payload').eq('office_id',officeId).eq('case_id',caseId).order('created_at',{ascending:false}).limit(100).abortSignal(abort.signal)
   .then(({data,error})=>{if(!abort.signal.aborted)setState({loading:false,rows:data||[],error:error?'無法讀取案件謄本，請重試。':''});})
   .catch(()=>{if(!abort.signal.aborted)setState({loading:false,rows:[],error:'連線失敗，請重試。'});});
  return()=>abort.abort();
 },[officeId,caseId,revision]);
 return <section className="case-transcripts"><h2>案件地籍資料</h2><p>已存入的核對紀錄保留土地、建物、所有權人及權利關係，不會自動以遮蔽姓名合併客戶。</p><button type="button" onClick={()=>{setState(s=>({...s,loading:true}));setRevision(v=>v+1);}}>重新讀取案件資料</button>{state.loading?<p role="status">讀取中…</p>:state.error?<p role="alert">{state.error}</p>:!state.rows.length?<p>此案尚未匯入謄本。請從「謄本匯入」選取已核對草稿並指定此案件。</p>:<>{state.rows.length===100&&<p>顯示最近 100 筆匯入紀錄。</p>}{state.rows.map(row=><details key={row.id}><summary>{new Date(row.created_at).toLocaleString('zh-TW')} · {row.payload.properties.length} 筆土地／建物</summary><StoredTranscript payload={row.payload}/></details>)}</>}</section>;
}
