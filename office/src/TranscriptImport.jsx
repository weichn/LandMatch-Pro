import { useEffect, useRef, useState } from 'react';
import { allFields, parseTranscript, textItemsToLines } from './transcript';
import {readReviewedDraft,toStoragePayload} from './transcriptDraft';
import SaveTranscript from './SaveTranscript';
import {createOcrSession,needsOcr} from './transcriptOcr';
import './transcript.css';

export default function TranscriptImport() {
 const [result,setResult]=useState(null),[fileName,setFileName]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false);
 const pdf=useRef(null),task=useRef(null),canvas=useRef(null),generation=useRef(0),pending=useRef(false);
 const ocr=useRef(null),cancelled=useRef(false);
 const selectedFile=useRef(null);
 const [forceOcr,setForceOcr]=useState(false);
 const [documentVersion,setDocumentVersion]=useState(0);
 useEffect(()=>()=>{generation.current++;ocr.current?.cancel();task.current?.destroy().catch(()=>{});},[]);
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
  selectedFile.current=/\.pdf$/i.test(file.name)?file:null;
  cancelled.current=false;
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
   const pages=[],ocrPages=[];
   let ocrPage=0;
   for(let n=1;n<=doc.numPages;n++){
    if(cancelled.current||id!==generation.current)throw new Error('ocr-cancelled');
    setStatus(`正在讀取第 ${n}／${doc.numPages} 頁…`);
    const p=await doc.getPage(n);const content=await p.getTextContent();
    let lines=textItemsToLines(content.items);
    if(forceOcr||needsOcr(lines)){
     ocrPage=n;
     if(!ocr.current)ocr.current=createOcrSession((progress,stage)=>{
      if(id===generation.current&&!cancelled.current)setStatus(stage==='recognizing text'?`正在本機辨識第 ${ocrPage}／${doc.numPages} 頁… ${Math.round(progress*100)}%`:'正在載入本機辨識工具與繁體中文模型，首次使用可能較久…');
     });
     const scanned=await ocr.current.recognize(p);
     lines=scanned.lines;ocrPages.push(n);
    }
    pages.push(lines);
   }
   if(cancelled.current)throw new Error('ocr-cancelled');
   if(id!==generation.current)return;
   const parsed=parseTranscript(pages,{ocrPages});
   if(!parsed.properties.length)throw new Error('no-properties');
   setFileName(file.name);setPage(1);setResult(parsed);setDocumentVersion(v=>v+1);setStatus('資料已帶入，請逐欄核對，再於下方選擇正式案件儲存。');
  }catch(e){
   await task.current?.destroy().catch(()=>{});task.current=null;pdf.current=null;setStatus('');
   if(id===generation.current){
    if(cancelled.current||e.message==='ocr-cancelled')setStatus('已取消，沒有傳送或儲存文件資料。');
    else setError(/\.json$/i.test(file.name)?(e instanceof SyntaxError?'草稿不是有效的 JSON 檔，請選擇工作台下載的核對草稿。':e.message):e.name==='PasswordException'?'這份 PDF 有密碼，請先在本機解鎖後再選取。':e.message==='too-many-pages'?'一次最多讀取 40 頁，請先分檔。':e.message?.startsWith('ocr-heading:')?`第 ${e.message.split(':')[1]} 頁影像辨識無法確認地號／建號，已停止匯入，避免歸入錯誤標的。請使用較清晰、正向的掃描檔。`:e.message==='ocr-timeout'?'影像辨識逾時，請分成較少頁數或使用更清晰的檔案再試。':'未能完成辨識。請確認網路可載入辨識工具，使用清晰且正向的土地／建物謄本再試；無法讀取不代表謄本空白。');
   }
  }finally{ocr.current?.cancel();ocr.current=null;pending.current=false;if(id===generation.current){setBusy(false);}}
 }
 function cancelRead(){cancelled.current=true;ocr.current?.cancel();void task.current?.destroy().catch(()=>{});}
 function change(field,patch){setResult(current=>{
  const next=structuredClone(current);
  const i=allFields(current).indexOf(field);Object.assign(allFields(next)[i],patch);return next;
 });}
 function exportDraft(){
  try{toStoragePayload(result);}catch(e){setError(e.message);return;}
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
  <p>選取電子或掃描地籍謄本，先帶出土地、建物、所有權人與他項權利，再對照原文核對。</p>
  <label className="review-check"><input type="checkbox" checked={forceOcr} disabled={busy} onChange={e=>setForceOcr(e.target.checked)}/>整份以影像辨識（適用文字層缺漏；需重新選檔）</label>
  <div className="transcript-upload"><label>選取謄本 PDF<input aria-label="選取謄本 PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value='';}}/></label><label>或讀回已核對草稿<input aria-label="讀回已核對草稿" type="file" accept="application/json,.json" disabled={busy} onChange={e=>{read(e.target.files?.[0]);e.target.value='';}}/></label><small>選檔只在本機解析。按下「確認存入正式案件」才傳送核對資料，原始 PDF 不上傳；未儲存前離開或重新整理會清除。</small></div>
  <p>無文字頁面會自動在本機辨識。影像辨識目前為試用功能，複雜底紋或模糊掃描可能無法讀取。首次使用需下載辨識工具，最多 40 頁。</p>
  {selectedFile.current&&!busy&&<button type="button" onClick={()=>read(selectedFile.current)}>重新讀取此 PDF（清除本頁核對）</button>}
  {status&&<p role="status">{status}</p>}{busy&&<button type="button" onClick={cancelRead}>取消讀取</button>}{error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<><div className="transcript-summary"><strong>{fileName}</strong><span>{result.pageCount} 頁 · {result.properties.length} 筆標的 · 已核對 {reviewed}／{fields.length} 欄</span></div>
   <div className="notice"><strong>需要確認</strong><ul>{[...new Set(result.warnings)].map(w=><li key={w}>{w}</li>)}</ul></div>
   <SaveTranscript key={documentVersion} result={result}/>
   <div className={pdf.current?'transcript-layout':'transcript-restored'}><div className="transcript-data">{result.properties.map(p=><article key={p.key}><h2>{p.kind}｜{p.fields.find(f=>f.key==='number')?.value}</h2>{group('標示資料',p,0)}{p.owners.map((r,i)=>group(`所有權人 ${i+1}`,r,i))}{p.common.map((r,i)=>group(`共有部分 ${i+1}`,r,i))}{p.rights.map((r,i)=>group(`他項權利 ${i+1}`,r,i))}</article>)}</div>
   {pdf.current&&<aside className="transcript-preview"><div className="preview-controls"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>上一頁</button><strong>原文 {page}／{result.pageCount}</strong><button disabled={page>=result.pageCount} onClick={()=>setPage(v=>v+1)}>下一頁</button></div><canvas ref={canvas} aria-label={`謄本原文第 ${page} 頁`}/></aside>}</div>
   <div className="transcript-finish"><p>本機備份可保留核對狀態，下次從「讀回已核對草稿」繼續。下載備份不等於存入正式案件。</p><button className="primary" disabled={!fields.length||reviewed!==fields.length||fields.some(f=>!f.value.trim())} onClick={exportDraft}>下載已核對草稿</button></div>
  </>}
 </section>;
}

