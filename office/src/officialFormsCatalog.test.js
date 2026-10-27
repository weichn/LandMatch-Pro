import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {officialFormsCatalog} from './officialFormsCatalog.js';

test('official library preserves blank/example distinctions and locally verified PDF integrity',async()=>{
 assert.equal(officialFormsCatalog.forms.length,129);
 const seen=new Set(),local=new Map();
 for(const form of officialFormsCatalog.forms){
  assert.ok(!seen.has(form.id));seen.add(form.id);
  assert.ok(['blank','example','instructions'].includes(form.variant));
  assert.ok(new URL(form.sourceUrl).hostname.endsWith('.gov.tw'));
  if(form.localFile){
   assert.equal(form.variant,'blank');
   assert.ok(/^library\/[a-z0-9-]+\.pdf$/.test(form.localFile));
   local.set(form.localFile,form);
  }
 }
 for(const [path,form] of local){
  const bytes=await readFile(new URL('../public/forms/'+path,import.meta.url));
  assert.ok(bytes.subarray(0,5).toString()==='%PDF-');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),form.pdfVerification.sha256);
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),form.pdfVerification.pageCount);
 }
 assert.equal(local.size,24);
 assert.equal(officialFormsCatalog.forms.find(f=>f.id==='hsinchu-3d423b62b6c1').variant,'example');
});
