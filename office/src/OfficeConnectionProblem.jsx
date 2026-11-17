import { useState } from 'react';
import { beginOfficeConnection, OfficeConnectError } from './officeConnect';

export default function OfficeConnectionProblem({ error }) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function retry(){
  if(busy)return;setBusy(true);setMessage('');
  try{await beginOfficeConnection();}
  catch(failure){setMessage(failure instanceof OfficeConnectError?failure.message:'目前無法登入工作台，請稍後重試。');setBusy(false);}
 }
 return <main className="welcome office-connect-problem"><section className="auth-card"><div className="eyebrow">LANDMATCH OFFICE</div><h1>工作台登入未完成</h1><p role="alert">{message||(error instanceof OfficeConnectError?error.message:'請重新從地政士帳號進入。')}</p><button className="primary wide" onClick={retry} disabled={busy}>{busy?'正在前往地政士登入…':'使用地政士帳號重新登入'}</button><a className="back-link" href="/">返回工作台登入</a></section></main>;
}
