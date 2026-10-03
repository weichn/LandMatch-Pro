const tables={contacts:[],organizations:[],office_cases:[],office_case_parties:[]};
export const db={from(table){let filters=[],insert=null,single=false,remove=false;const q={
select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},abortSignal(){return q;},
ilike(k,v){filters.push(r=>String(r[k]).includes(v.replaceAll('%','')));return q;},maybeSingle(){single=true;return q;},
insert(v){insert=v;return q;},delete(){remove=true;return q;},then(ok,bad){return Promise.resolve().then(()=>{if(insert){if(table==='office_case_parties'&&tables[table].some(r=>r.office_id===insert.office_id&&r.case_id===insert.case_id&&r.contact_id===insert.contact_id&&r.role===insert.role))return {data:null,error:{code:'23505'}};const row={...insert,id:crypto.randomUUID()};tables[table].push(row);return {data:[row],error:null};}let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(remove)tables[table]=tables[table].filter(r=>!rows.includes(r));if(table==='office_case_parties')rows=rows.map(r=>({...r,contacts:tables.contacts.find(c=>c.id===r.contact_id)}));return {data:single?rows[0]||null:rows,error:null};}).then(ok,bad);}
};return q;}};
