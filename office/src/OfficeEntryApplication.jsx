import { lazy, Suspense } from 'react';
import OfficeApp from './OfficeApp';
const TranscriptImport=lazy(()=>import('./TranscriptImport'));

export default function OfficeEntryApplication({returnTo}){
 return returnTo==='import'?<Suspense fallback={<p>載入謄本匯入…</p>}><TranscriptImport/></Suspense>:<OfficeApp/>;
}
