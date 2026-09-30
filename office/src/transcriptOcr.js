// One local worker per document; images never leave this browser.
export function ocrScale(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('invalid-page');
 return Math.min(3,Math.sqrt(8000000/(width*height)),4000/Math.max(width,height));
}
export function needsOcr(lines){return lines.join('').replace(/\s/g,'').length<30;}
export function createOcrSession(onProgress){
 let worker,closed=false,rejectStop;
 const stopped=new Promise((_,reject)=>{rejectStop=reject;});
 // An idle session may be cancelled before the first recognize() call.
 stopped.catch(()=>{});
 const start=import('tesseract.js').then(async ({createWorker})=>{
  if(closed)throw new Error('ocr-cancelled');
  const base=new URL('/ocr/',window.location.origin).href;
  const created=await createWorker('chi_tra',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base.slice(0,-1),workerBlobURL:false,cacheMethod:'none',logger:m=>{if(!closed)onProgress(m.progress||0,m.status);},errorHandler:()=>{rejectStop(new Error('ocr-failed'));}});
  if(closed){await created.terminate();throw new Error('ocr-cancelled');}
  worker=created;
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'216'});
  return worker;
 });
 start.catch(()=>{});
 function cancel(){closed=true;rejectStop(new Error('ocr-cancelled'));void worker?.terminate();}
 async function recognize(pdfPage){
  let timer,render;
  const canvas=document.createElement('canvas');
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('ocr-timeout')),180000);});
   const work=(async()=>{
    const engine=await start;
    if(closed)throw new Error('ocr-cancelled');
    const size=pdfPage.getViewport({scale:1});
    const viewport=pdfPage.getViewport({scale:ocrScale(size.width,size.height)});
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    render=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});
    await render.promise;
    if(closed)throw new Error('ocr-cancelled');
    // Synchronous encoding avoids Tesseract's asynchronous canvas FileReader
    // dispatching a job after cancellation has already terminated its worker.
    const {data}=await engine.recognize(canvas.toDataURL('image/png'));
    return {lines:data.text.split('\n'),confidence:data.confidence};
   })();
   return await Promise.race([work,stopped,timeout]);
  }catch(e){cancel();throw e;}
  finally{clearTimeout(timer);render?.cancel();canvas.width=0;canvas.height=0;}
 }
 return {recognize,cancel};
}
