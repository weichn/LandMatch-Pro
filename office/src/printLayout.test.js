import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PageSizes,StandardFonts,PDFArray,PDFDict,PDFName,PDFRawStream,PDFBool,degrees,decodePDFRawStream} from 'pdf-lib';
import {applyPrintLayout,paperLayouts} from './printLayout.js';
const A3=[297*72/25.4,420*72/25.4];
const near=(a,b,t=.02)=>assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);
const decoded=stream=>new TextDecoder().decode(decodePDFRawStream(stream).decode());
function content(page){const raw=page.node.Contents();if(!raw)return '';return(raw instanceof PDFArray?raw.asArray():[raw]).map(ref=>decoded(page.doc.context.lookup(ref,PDFRawStream))).join('\n');}
function forms(page){const dict=page.node.Resources().lookupMaybe(PDFName.of('XObject'),PDFDict);return dict?dict.entries().map(([,ref])=>page.doc.context.lookup(ref,PDFRawStream)):[];}
function matrices(page){return content(page).split(/\bq\s*/).filter(group=>/\bDo\b/.test(group)).map(group=>[...group.matchAll(/([-+\de.]+) ([-+\de.]+) ([-+\de.]+) ([-+\de.]+) ([-+\de.]+) ([-+\de.]+) cm/g)].map(match=>match.slice(1).map(Number)));}
function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const numbers=object=>object.asArray().map(value=>value.asNumber());
async function sample(sizes){const source=await PDFDocument.create();for(const [i,size]of sizes.entries())source.addPage(size).drawText('PAGE_'+(i+1),{x:40,y:40});return source;}
function assertA3(pdf){for(const page of pdf.getPages()){near(page.getWidth(),A3[0]);near(page.getHeight(),A3[1]);assert.equal(page.getRotation().angle,0);}}
function assertMarkers(page,labels){const actual=forms(page).map(decoded);assert.equal(actual.length,labels.length);labels.forEach((number,i)=>assert.ok(actual[i].includes(Buffer.from('PAGE_'+number).toString('hex').toUpperCase()),'source page order changed'));}

test('adjacent landscape pages combine in order; odd tail remains on upper half',async()=>{
 const source=await sample([[842,595],[842,595],[842,595]]);source.setTitle('Example');source.setSubject('Pending review');
 const input=await source.save(),result=await PDFDocument.load(await applyPrintLayout(input));
 assert.equal(result.getPageCount(),2);assertA3(result);assertMarkers(result.getPage(0),[1,2]);assertMarkers(result.getPage(1),[3]);assert.equal(result.getSubject(),'Pending review');
 assert.ok(matrices(result.getPage(1))[0][0][5]>=A3[1]/2);assert.equal(await applyPrintLayout(input,'original'),input);
 await assert.rejects(applyPrintLayout(input,'unknown'),/列印版型/);assert.ok(!paperLayouts.find(layout=>layout.id==='original').label.includes('A4'));
});
test('portrait sheets get entire A3 and mixed orientation never reorders pages',async()=>{
 const source=await sample([[842,595],PageSizes.A4,[842,595],[842,595],PageSizes.A3]);
 const output=await PDFDocument.load(await applyPrintLayout(await source.save()));assert.equal(output.getPageCount(),4);assertA3(output);
 [[1],[2],[3,4],[5]].forEach((labels,i)=>assertMarkers(output.getPage(i),labels));
 const scale=matrices(output.getPage(1))[0][2];near(scale[0],Math.SQRT2,.01);near(scale[3],scale[0]);
 const native=matrices(output.getPage(3))[0][2];near(native[0],1,.001);near(native[3],1,.001);
});
test('CropBox origins and quadrant rotations fit the visible rectangle without clipping',async()=>{
 const source=await PDFDocument.create();for(const rotation of [0,90,180,270]){const w=rotation%180===0?842:595,h=rotation%180===0?595:842,page=source.addPage([w+80,h+90]);page.setMediaBox(10,20,w+80,h+90);page.setCropBox(40,55,w,h);page.setRotation(degrees(rotation));page.drawText('ROTATION_'+rotation,{x:60,y:100});}
 const output=await PDFDocument.load(await applyPrintLayout(await source.save()));assert.equal(output.getPageCount(),2);assertA3(output);
 for(const page of output.getPages()){const groups=matrices(page);assert.equal(groups.length,2);forms(page).forEach((stream,index)=>{
  const box=numbers(stream.dict.lookup(PDFName.of('BBox'))),embed=numbers(stream.dict.lookup(PDFName.of('Matrix')));assert.equal(box[0],40);assert.equal(box[1],55);
  const full=multiply(groups[index].reduce(multiply,[1,0,0,1,0,0]),embed),corners=[[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]].map(point=>transform(full,point));
  const xs=corners.map(point=>point[0]),ys=corners.map(point=>point[1]);assert.ok(Math.min(...xs)>=-.001&&Math.max(...xs)<=A3[0]+.001);assert.ok(Math.min(...ys)>=(index===0?A3[1]/2:0)-.001&&Math.max(...ys)<=(index===0?A3[1]:A3[1]/2)+.001);near(groups[index][2][0],groups[index][2][3],.000001);
 });}
});
test('actual original Rotate 90 official application becomes one complete A3 sheet',async()=>{
 const bytes=new Uint8Array(await readFile(new URL('../public/forms/application.pdf',import.meta.url))),source=await PDFDocument.load(bytes);assert.equal(source.getPage(0).getRotation().angle,90);
 const output=await PDFDocument.load(await applyPrintLayout(bytes));assert.equal(output.getPageCount(),1);assertA3(output);assert.equal(forms(output.getPage(0)).length,2);
});
test('blank portrait page remains a full sheet instead of failing to embed',async()=>{
 const source=await PDFDocument.create();source.addPage(PageSizes.A4);const output=await PDFDocument.load(await applyPrintLayout(await source.save()));assert.equal(output.getPageCount(),1);assertA3(output);
});
async function interactive(){const source=await PDFDocument.create(),page=source.addPage(PageSizes.A4),form=source.getForm(),font=await source.embedFont(StandardFonts.Helvetica),field=form.createTextField('sample');field.setText('Field 123');field.addToPage(page,{x:50,y:400,width:200,height:40});form.updateFieldAppearances(font);return{source,form,field,widget:field.acroField.getWidgets()[0]};}
test('safe existing field appearance is preserved byte-for-byte when flattened',async()=>{
 const {source,field}=await interactive(),input=await source.save({updateFieldAppearances:false});
 const reopened=await PDFDocument.load(input),widget=reopened.getForm().getTextField(field.getName()).acroField.getWidgets()[0];
 const appearance=decoded(reopened.context.lookup(widget.getNormalAppearance(),PDFRawStream));
 const output=await PDFDocument.load(await applyPrintLayout(input));assert.equal(output.getForm().getFields().length,0);assert.equal(output.getPage(0).node.Annots()?.size()||0,0);
 assert.ok(output.context.enumerateIndirectObjects().some(([,object])=>object instanceof PDFRawStream&&decoded(object)===appearance),'field appearance must not be replaced or dropped');
 assert.equal((await PDFDocument.load(input)).getForm().getTextField(field.getName()).getText(),'Field 123');
});
test('missing, stale or orphan field appearance refuses A3; original bytes stay downloadable',async()=>{
 for(const mode of ['missing','stale','orphan']){const {source,widget}=await interactive();if(mode==='missing')widget.dict.delete(PDFName.of('AP'));if(mode==='stale')source.getForm().acroForm.dict.set(PDFName.of('NeedAppearances'),PDFBool.True);if(mode==='orphan')source.catalog.delete(PDFName.of('AcroForm'));const input=await source.save({updateFieldAppearances:false});await assert.rejects(applyPrintLayout(input),/官方原版/);assert.equal(await applyPrintLayout(input,'original'),input);}
});
