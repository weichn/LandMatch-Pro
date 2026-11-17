// Local-only harness: vite.editor.config.js replaces the DB with an in-memory fixture.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RecordEditor} from '../src/OfficeApp';
import '../src/office.css';
function Test(){const [open,setOpen]=useState(true),[result,setResult]=useState(null);
return <><h1>隔離測試，不連線正式資料庫</h1><button onClick={()=>setOpen(true)}>開啟表單</button><pre>{JSON.stringify(result,null,2)}</pre>{open&&<RecordEditor table="office_cases" row={{}} officeId="test-office" canWrite onClose={()=>setOpen(false)} onSaved={r=>{setResult(r);setOpen(false);}}/>}</>;}
createRoot(document.getElementById('root')).render(<Test/>);
