export const statusLabels = {draft:'草稿',active:'辦理中',on_hold:'暫停',completed:'已結案',cancelled:'已取消'};
export const roleLabels = {owner:'負責人',admin:'管理員',staff:'承辦人員',viewer:'唯讀成員'};
export const caseTypes = ['買賣','贈與','繼承','抵押權設定','其他'];
export const definitions = {
 office_cases: {label:'案件',name:'title',columns:'id,office_id,case_number,title,case_type,status,primary_contact_id,organization_id,assigned_member_id,opened_on,closed_on,updated_at',
 fields:[['case_type','案件類型','caseType',100,true],['case_number','案號','text',100,true],['title','案件名稱','text',300,true],['status','進度','status'],['primary_contact_id','主要聯絡人','contacts'],['organization_id','往來組織','organizations'],['opened_on','開案日期','date'],['closed_on','結案日期','date']]},
 contacts: {label:'聯絡人',name:'display_name',columns:'id,office_id,display_name,phone,email,address,organization_id,updated_at',
 fields:[['display_name','姓名','text',200,true],['phone','電話','tel',100],['email','Email','email',254],['address','地址','text',500],['organization_id','所屬組織','organizations']]},
 organizations: {label:'組織',name:'name',columns:'id,office_id,name,registration_number,phone,email,address,updated_at',
 fields:[['name','組織名稱','text',200,true],['registration_number','統一編號／登記編號','text',100],['phone','電話','tel',100],['email','Email','email',254],['address','地址','text',500]]}
};
export function payloadFor(table, form) {
 const fields=definitions[table].fields;
 return Object.fromEntries(fields.map(([key])=>[key, typeof form[key]==='string' ? form[key].trim() || null : form[key] ?? null]));
}
export function errorText(error) {
 if(error?.code==='23505') return '案號已存在，請使用另一個案號。';
 if(error?.code==='23503') return '此資料仍有案件或聯絡人引用，或關聯資料已不存在。請先調整關聯。';
 if(error?.code==='42501') return '目前帳號沒有這項操作權限。請確認 Email 已驗證，或重新登入。';
 if(error?.code==='23514'||error?.code==='22023') return '資料格式不符，請檢查必填欄位與日期。';
 return '操作未完成，請檢查網路後重試。若持續發生，請聯絡管理員。';
}
