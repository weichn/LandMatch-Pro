import { useEffect, useRef, useState } from 'react';
import { allFields, parseTranscript, textItemsToLines } from './transcript';
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
   if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024){setError('請選擇 20 MB 以內的 PDF。照片與掃描 OCR 尚未開放。');return;}
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
   setFileName(file.name);setPage(1);setResult(parsed);setDocumentVersion(v=>v+1);setStatus('資料已帶入，請逐欄核對。尚未寫入案件或客戶資料庫。');
  }catch(e){
   await task.current?.destroy().catch(()=>{});task.current=null;pdf.current=null;setStatus('');
   if(id===generation.current)setError(e.name==='PasswordException'?'這份 PDF 有密碼，請先在本機解鎖後再選取。':e.message==='too-many-pages'?'一次最多讀取 40 頁，請先分檔。':'無法辨識此檔案的土地／建物文字層。可能是掃描檔或不支援的格式，請勿視為空白謄本。');
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
  <div className="field-source"><button type="button" onClick={()=>setPage(f.page)}>原文第 {f.page} 頁</button><label className="review-check"><input type="checkbox" checked={f.reviewed} onChange={e=>change(f,{reviewed:e.target.checked})}/>已核對</label></div>
  <small>{f.source}</small>
 </div>)}</fieldset>;}
 const fields=result?allFields(result):[],reviewed=fields.filter(f=>f.reviewed).length;
 return <section className="transcript-import">
  <a href="/">← 返回 Office 工作台</a><div className="eyebrow">DOCUMENT TO DATA</div><h1>從謄本，自動帶入資料</h1>
  <p>選取電子地籍謄本，先帶出土地、建物、所有權人與他項權利，再對照原文核對。</p>
  <div className="transcript-upload"><label>選取謄本 PDF<input aria-label="選取謄本 PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value='';}}/></label><small>檔案在本機瀏覽器解析，不上傳。離開或重新整理後清除；目前支援有文字層的土地／建物謄本。</small></div>
  {status&&<p role="status">{status}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<><div className="transcript-summary"><strong>{fileName}</strong><span>{result.pageCount} 頁 · {result.properties.length} 筆標的 · 已核對 {reviewed}／{fields.length} 欄</span></div>
   <div className="notice"><strong>需要確認</strong><ul>{[...new Set(result.warnings)].map(w=><li key={w}>{w}</li>)}</ul></div>
   <div className="transcript-layout"><div className="transcript-data">{result.properties.map(p=><article key={p.key}><h2>{p.kind}｜{p.fields.find(f=>f.key==='number')?.value}</h2>{group('標示資料',p,0)}{p.owners.map((r,i)=>group(`所有權人 ${i+1}（不是申請人或銀行）`,r,i))}{p.common.map((r,i)=>group(`共有部分 ${i+1}`,r,i))}{p.rights.map((r,i)=>group(`他項權利 ${i+1}`,r,i))}</article>)}</div>
   <aside className="transcript-preview"><div className="preview-controls"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>上一頁</button><strong>原文 {page}／{result.pageCount}</strong><button disabled={page>=result.pageCount} onClick={()=>setPage(v=>v+1)}>下一頁</button></div><canvas ref={canvas} aria-label={`謄本原文第 ${page} 頁`}/></aside></div>
   <div className="transcript-finish"><p>逐欄確認後可下載本機核對草稿。此版尚未將土地／建物匯入正式案件，不會自動新增客戶；遮蔽姓名不能用來合併身分。</p><button className="primary" disabled={!fields.length||reviewed!==fields.length||fields.some(f=>!f.value.trim())} onClick={exportDraft}>下載已核對草稿</button></div>
  </>}
 </section>;
}

