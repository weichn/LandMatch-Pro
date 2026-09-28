import { useEffect, useRef, useState } from 'react';
import { allFields, parseTranscript, textItemsToLines } from './transcript';
import {readReviewedDraft} from './transcriptDraft';
import SaveTranscript from './SaveTranscript';
import './transcript.css';

export default function TranscriptImport() {
 const [result,setResult]=useState(null),[fileName,setFileName]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false);
 const pdf=useRef(null),task=useRef(null),canvas=useRef(null),generation=useRef(0),pending=useRef(false);
 const [documentVersion,setDocumentVersion]=useState(0);
 useEffect(()=>()=>{generation.current++;task.current?.destroy();},[]);
 useEffect(()=>{
  if(!pdf.current||!canvas.current)return;
  let cancelled=false,render;
  pdf.current.getPage(page).then(p=>{
   if(cancelled)return;
   const viewport=p.getViewport({scale:1.5});
   const el=canvas.current;el.width=viewport.width;el.height=viewport.height;
   render=p.render({canvasContext:el.getContext('2d'),viewport});
   return render.promise;
  }).catch(()=>{if(!cancelled)setError('此頁預覽未完成，請另開原檔核對。');});
  return ()=>{cancelled=true;render?.cancel();};
 },[documentVersion,page]); // values and confirmations do not rerender PDF
 async function read(file){
  if(!file||pending.current)return;
  pending.current=true;setBusy(true);
  const id=++generation.current;
  setResult(null);setError('');setStatus('');setFileName('');
  try{
   await task.current?.destroy();task.current=null;pdf.current=null;
   if(/\.json$/i.test(file.name)){
    if(file.size>500000)throw new Error('草稿超過 500 KB，請選擇工作台下載的核對草稿。');
    const restored=readReviewedDraft(await file.text());
    if(id!==generation.current)return;
    setFileName(file.name);setPage(1);setResult(restored);setDocumentVersion(v=>v+1);setStatus('已讀回核對草稿，保留原核對狀態。請到下方「存入正式案件」選擇案件。');return;
   }
   if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024){setError('請選擇 20 MB 以內的 PDF，或 500 KB 以內的核對草稿 JSON。');return;}
   const lib=await import('pdfjs-dist');
   const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
   lib.GlobalWorkerOptions.workerSrc=worker.default;
   const loading=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,enableXfa:false});task.current=loading;
   const doc=await loading.promise;
   if(id!==generation.current){await loading.destroy();return;}
   pdf.current=doc;
   if(doc.numPages>40)throw new Error('too-many-pages');
   const pages=[];
   for(let n=1;n<=doc.numPages;n++){
    setStatus(`正在讀取第 ${n}／${doc.numPages} 頁…`);
    const p=await doc.getPage(n);const content=await p.getTextContent();pages.push(textItemsToLines(content.items));
   }
   if(id!==generation.current)return;
   const parsed=parseTranscript(pages);
   if(!parsed.properties.length)throw new Error('no-properties');
   setFileName(file.name);setPage(1);setResult(parsed);setDocumentVersion(v=>v+1);setStatus('資料已帶入，請逐欄核對，再於下方選擇正式案件儲存。');
  }catch(e){
   await task.current?.destroy().catch(()=>{});task.current=null;pdf.current=null;setStatus('');
   if(id===generation.current)setError(/\.json$/i.test(file.name)?(e instanceof SyntaxError?'草稿不是有效的 JSON 檔，請選擇工作台下載的核對草稿。':e.message):e.name==='PasswordException'?'這份 PDF 有密碼，請先在本機解鎖後再選取。':e.message==='too-many-pages'?'一次最多讀取 40 頁，請先分檔。':'無法辨識此檔案的土地／建物文字層。可能是掃描檔或不支援的格式，請勿視為空白謄本。');
  }finally{pending.current=false;if(id===generation.current){setBusy(false);}}
 }
 function change(field,patch){setResult(current=>{
  const next=structuredClone(current);
  const i=allFields(current).indexOf(field);Object.assign(allFields(next)[i],patch);return next;
 });}
 function exportDraft(){
  // Explicit local download only. Never export original text, PDF, or identity number.
  const clean=structuredClone(result);allFields(clean).forEach(f=>delete f.source);
  const url=URL.createObjectURL(new Blob([JSON.stringify({...clean,status:'reviewed-local-draft',exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='謄本核對草稿.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function group(title,item,index){return <fieldset key={title+index} className="transcript-group"><legend>{title}</legend>{item.fields.map(f=><div className="transcript-field" key={f.key}>
  <label>{f.label}<input value={f.value} onChange={e=>change(f,{value:e.target.value,reviewed:false})}/></label>
  <div className="field-source">{pdf.current?<button type="button" onClick={()=>setPage(f.page)}>原文第 {f.page} 頁</button>:<small>來源第 {f.page} 頁</small>}<label className="review-check"><input type="checkbox" checked={f.reviewed} onChange={e=>change(f,{reviewed:e.target.checked})}/>已核對</label></div>
  <small>{f.source}</small>
 </div>)}</fieldset>;}
 const fields=result?allFields(result):[],reviewed=fields.filter(f=>f.reviewed).length;
 return <section className="transcript-import">
  <a href="/">← 返回 Office 工作台</a><div className="eyebrow">DOCUMENT TO DATA</div><h1>從謄本，自動帶入資料</h1>
  <p>選取電子地籍謄本，先帶出土地、建物、所有權人與他項權利，再對照原文核對。</p>
  <div className="transcript-upload"><label>選取謄本 PDF<input aria-label="選取謄本 PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value='';}}/></label><label>或讀回已核對草稿<input aria-label="讀回已核對草稿" type="file" accept="application/json,.json" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value='';}}/></label><small>選檔只在本機解析。按下「確認存入正式案件」才傳送核對資料，原始 PDF 不上傳；未儲存前離開或重新整理會清除。</small></div>
  {status&&<p role="status">{status}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<><div className="transcript-summary"><strong>{fileName}</strong><span>{result.pageCount} 頁 · {result.properties.length} 筆標的 · 已核對 {reviewed}／{fields.length} 欄</span></div>
   <div className="notice"><strong>需要確認</strong><ul>{[...new Set(result.warnings)].map(w=><li key={w}>{w}</li>)}</ul></div>
   <SaveTranscript key={documentVersion} result={result}/>
   <div className={pdf.current?'transcript-layout':'transcript-restored'}><div className="transcript-data">{result.properties.map(p=><article key={p.key}><h2>{p.kind}｜{p.fields.find(f=>f.key==='number')?.value}</h2>{group('標示資料',p,0)}{p.owners.map((r,i)=>group(`所有權人 ${i+1}`,r,i))}{p.common.map((r,i)=>group(`共有部分 ${i+1}`,r,i))}{p.rights.map((r,i)=>group(`他項權利 ${i+1}`,r,i))}</article>)}</div>
   {pdf.current&&<aside className="transcript-preview"><div className="preview-controls"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>上一頁</button><strong>原文 {page}／{result.pageCount}</strong><button disabled={page>=result.pageCount} onClick={()=>setPage(v=>v+1)}>下一頁</button></div><canvas ref={canvas} aria-label={`謄本原文第 ${page} 頁`}/></aside>}</div>
   <div className="transcript-finish"><p>本機備份可保留核對狀態，下次從「讀回已核對草稿」繼續。下載備份不等於存入正式案件。</p><button className="primary" disabled={!fields.length||reviewed!==fields.length||fields.some(f=>!f.value.trim())} onClick={exportDraft}>下載已核對草稿</button></div>
  </>}
 </section>;
}

