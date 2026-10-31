// Run only with the synthetic image-only PDF described in README.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createWorker} from 'tesseract.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {parseTranscript,allFields} from '../src/transcript.js';
import {toStoragePayload} from '../src/transcriptDraft.js';
import {ocrScale} from '../src/transcriptOcr.js';
const loading=getDocument({data:new Uint8Array(await readFile(process.argv[2])),isEvalSupported:false});
const doc=await loading.promise;
const worker=await createWorker('chi_tra',1,{langPath:resolve('public/ocr'),cacheMethod:'none'});
try{
 const page=await doc.getPage(1);
 assert.equal((await page.getTextContent()).items.length,0,'fixture must have no text layer');
 const size=page.getViewport({scale:1});
 const viewport=page.getViewport({scale:ocrScale(size.width,size.height)});
 const target=doc.canvasFactory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:target.context,viewport}).promise;
 await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'216'});
 const {data}=await worker.recognize(target.canvas.toBuffer('image/png'));
 doc.canvasFactory.destroy(target);
 const parsed=parseTranscript([data.text],{ocrPages:[1]});
 const p=parsed.properties[0];
 assert.equal(p.fields.find(f=>f.key==='number').value,'0123-0000');
 assert.equal(p.fields.find(f=>f.key==='area').value,'123.45');
 assert.equal(p.fields.find(f=>f.key==='zone').value,'住宅區');
 assert.equal(p.owners[0].fields.find(f=>f.key==='name').value,'測試人');
 assert.equal(p.owners[0].fields.find(f=>f.key==='address').value,'測試區範例路1號');
 assert.equal(p.owners[0].fields.find(f=>f.key==='share').value,'全部1分之1');
 assert(allFields(parsed).every(f=>!f.reviewed));
 assert.throws(()=>toStoragePayload(parsed));
 allFields(parsed).forEach(f=>{f.reviewed=true;});
 assert.equal(toStoragePayload(parsed).properties.length,1);
 console.log('PASS: image-only PDF → local OCR → property/owner/address/share → review gate → storage payload. No database write.');
}finally{await worker.terminate();await loading.destroy();}
