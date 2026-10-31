import {PDFDocument,PDFArray,PDFDict,PDFName,PDFRef,PDFStream,PDFSignature,PDFCheckBox,PDFRadioGroup,degrees} from 'pdf-lib';

export const paperLayouts=[
 {id:'a3',label:'A3 直式（相鄰橫式頁上下合併；直式頁單張）'},
 {id:'original',label:'官方原版分頁與紙張尺寸'},
];
const A3=[297*72/25.4,420*72/25.4];
const unsafeForm='這份 PDF 的互動欄位或註記無法安全合併，請選擇「官方原版分頁與紙張尺寸」下載列印。';
const name=value=>PDFName.of(value);
const close=(a,b)=>Math.abs(a-b)<.01;

function widgetAnnotations(doc){
 const widgets=[];
 for(const page of doc.getPages())for(const ref of page.node.Annots()?.asArray()||[]){
  const annotation=doc.context.lookup(ref,PDFDict),subtype=annotation.lookupMaybe(name('Subtype'),PDFName);
  if(subtype===name('Widget'))widgets.push(annotation);
  else if(subtype!==name('Link'))throw new Error(unsafeForm);
 }
 return widgets;
}

/** Flatten only existing, printable appearances that PDF-lib can preserve without regenerating text. */
function preserveWidgetAppearances(doc){
 try{
  const pageWidgets=widgetAnnotations(doc),acro=doc.catalog.lookupMaybe(name('AcroForm'),PDFDict);
  if(!acro){if(pageWidgets.length)throw new Error(unsafeForm);return;}
  const form=doc.getForm(),fields=form.getFields();
  if(form.hasXFA()||String(acro.get(name('NeedAppearances')))==='true'||fields.some(field=>field instanceof PDFSignature))throw new Error(unsafeForm);
  if(!pageWidgets.length){if(fields.length)throw new Error(unsafeForm);return;}
  const canonicalWidgets=fields.flatMap(field=>field.acroField.getWidgets().map(widget=>({field,widget})));
  if(canonicalWidgets.length!==pageWidgets.length||pageWidgets.some(widget=>!canonicalWidgets.some(entry=>entry.widget.dict===widget)))throw new Error(unsafeForm);
  for(const {field,widget} of canonicalWidgets){
   if(field.needsAppearancesUpdate()||!(widget.getFlags()&4)||(widget.getFlags()&3))throw new Error(unsafeForm);
   let appearance=widget.getNormalAppearance();
   if(appearance instanceof PDFDict){
    if(!(field instanceof PDFCheckBox||field instanceof PDFRadioGroup))throw new Error(unsafeForm);
    const value=field.acroField.getValue(),state=appearance.has(value)?value:name('Off');
    if(widget.getAppearanceState()!==state)throw new Error(unsafeForm);
    appearance=appearance.get(state);
   }
   if(!(appearance instanceof PDFRef))throw new Error(unsafeForm);
   const stream=doc.context.lookup(appearance,PDFStream),bbox=stream.dict.lookup(name('BBox')).asArray().map(value=>value.asNumber());
   const matrix=stream.dict.lookupMaybe(name('Matrix'),PDFArray)?.asArray().map(value=>value.asNumber())||[1,0,0,1,0,0];
   const rectangle=widget.getRectangle();
   if(!stream.getContents().length||bbox.length!==4||!close(bbox[0],0)||!close(bbox[1],0)||!close(bbox[2],rectangle.width)||!close(bbox[3],rectangle.height)||matrix.length!==6||matrix.some((value,i)=>!close(value,[1,0,0,1,0,0][i])))throw new Error(unsafeForm);
  }
  // Updating with Helvetica would lose Chinese or change an official appearance. Keep AP bytes intact.
  const retained=doc.getPages().map(page=>({page,refs:(page.node.Annots()?.asArray()||[]).filter(ref=>doc.context.lookup(ref,PDFDict).lookupMaybe(name('Subtype'),PDFName)!==name('Widget'))}));
  form.flatten({updateFieldAppearances:false});
  // pdf-lib can leave references to removed widgets in /Annots; retain only the preflighted non-widgets.
  for(const {page,refs} of retained){if(refs.length)page.node.set(name('Annots'),doc.context.obj(refs));else page.node.delete(name('Annots'));}
  if(widgetAnnotations(doc).length||form.getFields().length)throw new Error(unsafeForm);
 }catch(error){if(error.message===unsafeForm)throw error;throw new Error(unsafeForm,{cause:error});}
}

function geometry(page){
 const media=page.getMediaBox(),crop=page.getCropBox();
 const left=Math.max(media.x,crop.x),bottom=Math.max(media.y,crop.y);
 const right=Math.min(media.x+media.width,crop.x+crop.width),top=Math.min(media.y+media.height,crop.y+crop.height);
 const width=right-left,height=top-bottom,rotation=((page.getRotation().angle%360)+360)%360;
 if(![width,height,left,bottom].every(Number.isFinite)||width<=0||height<=0||![0,90,180,270].includes(rotation))throw new Error('這份 PDF 的頁面尺寸或旋轉無法合併，請使用官方原版列印。');
 const rotated=rotation===90||rotation===270;
 return {bounds:{left,bottom,right,top},width,height,rotation,displayWidth:rotated?height:width,displayHeight:rotated?width:height};
}

async function drawSourcePage(output,target,page,g,slotBottom,slotHeight){
 if(!page.node.Contents())return;
 const embedded=await output.embedPage(page,g.bounds);
 const scale=Math.min(A3[0]/g.displayWidth,slotHeight/g.displayHeight);
 const x=(A3[0]-g.displayWidth*scale)/2,y=slotBottom+(slotHeight-g.displayHeight*scale)/2;
 const offsets=g.rotation===90?[0,g.width*scale]:g.rotation===180?[g.width*scale,g.height*scale]:g.rotation===270?[g.height*scale,0]:[0,0];
 target.drawPage(embedded,{x:x+offsets[0],y:y+offsets[1],width:g.width*scale,height:g.height*scale,rotate:degrees(-g.rotation)});
}

/** Preserve source orientation and sequence. Only adjacent landscape pages share an A3 sheet. */
export async function applyPrintLayout(bytes,layout='a3'){
 if(layout==='original')return bytes;
 if(layout!=='a3')throw new Error('請選擇列印版型。');
 const source=await PDFDocument.load(bytes),output=await PDFDocument.create();
 if(!source.getPageCount())throw new Error('這份 PDF 沒有可列印的頁面。');
 preserveWidgetAppearances(source);
 const pages=source.getPages(),sizes=pages.map(geometry);
 for(let i=0;i<pages.length;){
  const target=output.addPage(A3),g=sizes[i];
  if(g.displayWidth>g.displayHeight){
   await drawSourcePage(output,target,pages[i],g,A3[1]/2,A3[1]/2);i++;
   if(i<pages.length&&sizes[i].displayWidth>sizes[i].displayHeight){await drawSourcePage(output,target,pages[i],sizes[i],0,A3[1]/2);i++;}
  }else{
   // Native A3 portrait remains approximately 1:1; A4 portrait gets the whole A3 sheet.
   await drawSourcePage(output,target,pages[i],g,0,A3[1]);i++;
  }
 }
 output.setTitle((source.getTitle()||'地政書表')+'（A3 直式）');
 output.setSubject(source.getSubject()||'官方書表列印');
 if(source.getAuthor())output.setAuthor(source.getAuthor());
 output.setCreator('LandMatch Office');output.setProducer('LandMatch Office');
 return output.save();
}
