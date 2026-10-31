import {copyFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const root=new URL('../public/ocr/',import.meta.url);
await mkdir(root,{recursive:true});
const core=dirname(require.resolve('tesseract.js-core/package.json'));
for(const name of await readdir(core)){
 if(/\.wasm(?:\.js)?$/.test(name))await copyFile(join(core,name),new URL(name,root));
}
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'),new URL('worker.min.js',root));
await copyFile(require.resolve('tesseract.js/LICENSE.md'),new URL('tesseract-LICENSE.md',root));
for(const language of ['chi_tra']){
 const data=dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
 await copyFile(join(data,'4.0.0_best_int',`${language}.traineddata.gz`),new URL(`${language}.traineddata.gz`,root));
 await copyFile(join(data,'package.json'),new URL(`${language}-package.json`,root));
}
await copyFile(join(core,'LICENSE'),new URL('core-LICENSE',root));
await copyFile(new URL('../licenses/tessdata-LICENSE',import.meta.url),new URL('tessdata-LICENSE',root));
console.log('Local OCR assets prepared. No document data included.');
