import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OfficeEntryApplication from './OfficeEntryApplication';
import OfficeConnectionProblem from './OfficeConnectionProblem';
import { db } from './client';
import { createOfficeEntryRunner } from './officeConnect';
import './office.css';
const root=createRoot(document.getElementById('root'));
root.render(<main className="loading" role="status">正在確認工作台登入…</main>);
const runEntry=createOfficeEntryRunner({auth:db.auth,fetchImpl:window.fetch.bind(window)});
runEntry().then(entry=>{
 if(entry.mode==='redirecting')return;
 root.render(<StrictMode><OfficeEntryApplication returnTo={entry.returnTo}/></StrictMode>);
}).catch(error=>root.render(<StrictMode><OfficeConnectionProblem error={error}/></StrictMode>));


