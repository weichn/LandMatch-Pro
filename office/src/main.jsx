import { StrictMode, lazy, Suspense } from 'react';
const TranscriptImport = lazy(() => import('./TranscriptImport'));
import { createRoot } from 'react-dom/client';
import OfficeApp from './OfficeApp';
import './office.css';
createRoot(document.getElementById('root')).render(<StrictMode>{new URLSearchParams(window.location.search).has('import') ? <Suspense fallback={<p>載入謄本匯入…</p>}><TranscriptImport/></Suspense> : <OfficeApp/>}</StrictMode>);


