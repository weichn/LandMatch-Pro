import {useEffect,useRef,useState} from 'react';
import './registration-preview.css';

function pdfBlob(bytes) {
 if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new Error('請先產生文件預覽。');
 return new Blob([bytes],{type:'application/pdf'});
}

export async function downloadPdf(bytes,fileName='土地登記書表.pdf') {
 const url=URL.createObjectURL(pdfBlob(bytes));
 const link=document.createElement('a');
 link.href=url;
 link.download=String(fileName).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
 document.body.appendChild(link);
 try {link.click();}
 finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);}
}

/** Call from the user's click handler while browser activation is still available. */
export async function openPrintablePdf(bytes) {
 const url=URL.createObjectURL(pdfBlob(bytes));
 const tab=window.open('','_blank');
 if (!tab) {
  URL.revokeObjectURL(url);
  throw new Error('瀏覽器已阻擋新分頁，請允許開啟列印分頁，或使用「下載 PDF」後列印。');
 }
 try {
  tab.opener=null;
  tab.location.replace(url);
 } catch {
  tab.close();
  URL.revokeObjectURL(url);
  throw new Error('無法開啟列印分頁，請下載 PDF 後列印。');
 }
 // The browser PDF viewer owns printing; no document bytes are uploaded.
 setTimeout(()=>URL.revokeObjectURL(url),10*60_000);
}

export default function RegistrationPreview({bytes,busy=false,error='',title='土地登記書表'}) {
 const container=useRef(null);
 const [state,setState]=useState({rendering:false,pageCount:0,rendered:0,error:''});
 useEffect(()=>{
  const holder=container.current;
  holder.replaceChildren();
  if (!bytes) {
   setState({rendering:false,pageCount:0,rendered:0,error:''});
   return;
  }
  let cancelled=false,loadingTask,renderTask;
  setState({rendering:true,pageCount:0,rendered:0,error:''});
  void (async()=>{
   try {
    const [pdfjs,worker]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    if (cancelled) return;
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    // PDF.js may transfer its input buffer to its worker. Keep the export copy intact.
    loadingTask=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,enableXfa:false});
    const doc=await loadingTask.promise;
    if (cancelled) return;
    setState({rendering:true,pageCount:doc.numPages,rendered:0,error:''});
    for (let number=1;number<=doc.numPages;number++) {
     const page=await doc.getPage(number);
     if (cancelled) return;
     const viewport=page.getViewport({scale:1.4});
     const figure=document.createElement('figure');
     figure.className='registration-preview-page';
     const caption=document.createElement('figcaption');
     caption.textContent=`第 ${number}／${doc.numPages} 頁`;
     const canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);
     canvas.height=Math.ceil(viewport.height);
     canvas.setAttribute('role','img');
     canvas.setAttribute('aria-label',`${title} 第 ${number} 頁，共 ${doc.numPages} 頁`);
     figure.append(caption,canvas);
     holder.append(figure);
     renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});
     await renderTask.promise;
     renderTask=null;
     page.cleanup();
     if (cancelled) return;
     setState({rendering:number<doc.numPages,pageCount:doc.numPages,rendered:number,error:''});
    }
   } catch {
    if (!cancelled) setState(current=>({...current,rendering:false,error:'預覽無法完成，請重新產生文件；也可以下載 PDF 後核對全部頁面。'}));
   }
  })();
  return()=>{
   cancelled=true;
   renderTask?.cancel();
   void loadingTask?.destroy().catch(()=>{});
   holder.replaceChildren();
  };
 },[bytes,title]);
 return <section className="registration-preview" aria-label={`${title}預覽`} aria-busy={busy||state.rendering}>
  <div className="registration-preview-heading"><h3>官方書表預覽</h3>{state.pageCount>0&&!busy&&<span>共 {state.pageCount} 頁</span>}</div>
  {busy?<p className="registration-preview-status" role="status">正在產生文件…</p>:error?<p className="registration-preview-error" role="alert">{error}</p>:!bytes?<p className="registration-preview-status">核對資料後，按「產生預覽」查看套印結果。</p>:state.rendering&&<p className="registration-preview-status" role="status">正在繪製第 {Math.min(state.rendered+1,state.pageCount)||1} 頁…</p>}
  {state.error&&!busy&&!error&&<p className="registration-preview-error" role="alert">{state.error}</p>}
  <div ref={container} className="registration-preview-pages" hidden={busy||!!error}/>
 </section>;
}
