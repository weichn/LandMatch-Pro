const tables={contacts:[],organizations:[],office_cases:[]};
export const db={from(table){let filters=[],insert=null,single=false;const q={
select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},abortSignal(){return q;},
ilike(k,v){filters.push(r=>String(r[k]).includes(v.replaceAll('%','')));return q;},maybeSingle(){single=true;return q;},
insert(v){insert=v;return q;},then(ok,bad){return Promise.resolve().then(()=>{if(insert){const row={...insert,id:crypto.randomUUID()};tables[table].push(row);return {data:[row],error:null};}const rows=tables[table].filter(r=>filters.every(f=>f(r)));return {data:single?rows[0]||null:rows,error:null};}).then(ok,bad);}
};return q;}};
