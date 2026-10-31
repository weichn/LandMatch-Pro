-- All fixtures and their triggered projections are rolled back. No mail is sent.
begin;
create temporary table f(key text primary key, id uuid default gen_random_uuid(), session_id uuid default gen_random_uuid());
insert into f(key) values ('citizen'),('applicant'),('agent'),('admin'),('unverified'),('anonymous'),('banned'),('deleted'),('unknown');
grant select on f to authenticated, anon;
create function pg_temp.uid(k text) returns uuid language sql as $$select id from pg_temp.f where key=k$$;
create function pg_temp.sid(k text) returns uuid language sql as $$select session_id from pg_temp.f where key=k$$;
create temporary table results(label text, passed boolean);
grant insert, select on results to authenticated, anon;
create function pg_temp.verify(label text, q text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute q into actual; exception when others then actual:=SQLSTATE; end;
  if actual is distinct from expected then raise exception 'Fixture failed: %, expected %, received %',label,expected,actual; end if;
  insert into pg_temp.results values(label,true);
end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,banned_until,deleted_at,raw_user_meta_data)
select id,'authenticated','authenticated',id::text||'@office-eligibility.example.invalid',
  case when key='unverified' then null else now() end, key='anonymous',
  case when key='banned' then now()+interval '1 day' else null end,
  case when key='deleted' then now() else null end,
  jsonb_build_object('name','SSO Fixture '||key,'registration_audience',case when key='citizen' then 'public' else 'agent' end,
    'office_name','Metadata firm','practice_license_number','Fixture practice','license_number','Fixture certificate')
from f where key<>'unknown';
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select session_id,id,now(),now(),'aal1' from f where key<>'unknown';
update public.profiles set role='agent',points=25 where id=pg_temp.uid('agent');
update public.profiles set role='admin' where id=pg_temp.uid('admin');
update auth.users set raw_user_meta_data=raw_user_meta_data||'{"registration_audience":"agent","role":"admin"}'::jsonb
  where id=pg_temp.uid('citizen');
insert into public.agents(profile_id,name,firm_name,city,specialty)
  values(pg_temp.uid('agent'),'Fixture agent','Approved firm','臺北市','Fixture');
insert into public.agent_applications(user_id,office_name,practice_license_number,license_number,city)
  values(pg_temp.uid('applicant'),'Application firm','Fixture practice','Fixture certificate','臺北市');

select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.verify('anonymous cannot call source identity',$q$select count(*)::text from public.get_office_identity()$q$,'42501');
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select pg_temp.verify('missing identity returns no attestation',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('citizen'),'session_id',pg_temp.sid('citizen'),'role','authenticated')::text,true);
select pg_temp.verify('ordinary citizen cannot borrow Office through editable metadata',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('applicant'),'session_id',pg_temp.sid('applicant'),'role','authenticated')::text,true);
select pg_temp.verify('verified applicant gets self-only Office attestation',$q$select (count(*)=1 and bool_and(user_id=auth.uid() and role='client' and account_kind='agent'))::text from public.get_office_identity()$q$,'true');
select pg_temp.verify('application office name wins over editable label',$q$select office_name from public.get_office_identity()$q$,'Application firm');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('applicant'),'role','authenticated')::text,true);
select pg_temp.verify('missing session claim cannot authorize Office',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('applicant'),'session_id','malformed','role','authenticated')::text,true);
select pg_temp.verify('malformed session claim returns no identity',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('applicant'),'session_id',pg_temp.sid('agent'),'role','authenticated')::text,true);
select pg_temp.verify('another users session cannot authorize Office',$q$select count(*)::text from public.get_office_identity()$q$,'0');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id=pg_temp.sid('applicant');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('applicant'),'session_id',pg_temp.sid('applicant'),'role','authenticated')::text,true);
select pg_temp.verify('expired source session cannot authorize Office',$q$select count(*)::text from public.get_office_identity()$q$,'0');
reset role;
update auth.sessions set not_after=now()+interval '5 minutes' where id=pg_temp.sid('applicant');
set local role authenticated;
select pg_temp.verify('active future-bounded source session is accepted',$q$select count(*)::text from public.get_office_identity()$q$,'1');
reset role;
delete from auth.sessions where id=pg_temp.sid('applicant');
set local role authenticated;
select pg_temp.verify('revoked or logged-out source session is rejected',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('agent'),'session_id',pg_temp.sid('agent'),'role','authenticated')::text,true);
select pg_temp.verify('approved agent retains existing marketplace role',$q$select (count(*)=1 and bool_and(role='agent' and account_kind='agent'))::text from public.get_office_identity()$q$,'true');
select pg_temp.verify('approved public profile firm wins over metadata',$q$select office_name from public.get_office_identity()$q$,'Approved firm');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('admin'),'session_id',pg_temp.sid('admin'),'role','authenticated')::text,true);
select pg_temp.verify('administrator gets only own attestation',$q$select (count(*)=1 and bool_and(user_id=auth.uid() and role='admin' and account_kind='admin'))::text from public.get_office_identity()$q$,'true');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('unverified'),'session_id',pg_temp.sid('unverified'),'role','authenticated')::text,true);
select pg_temp.verify('unverified source rejected',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('anonymous'),'session_id',pg_temp.sid('anonymous'),'role','authenticated')::text,true);
select pg_temp.verify('anonymous Auth user rejected',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('banned'),'session_id',pg_temp.sid('banned'),'role','authenticated')::text,true);
select pg_temp.verify('banned source rejected despite existing JWT claims',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('deleted'),'session_id',pg_temp.sid('deleted'),'role','authenticated')::text,true);
select pg_temp.verify('soft deleted source rejected',$q$select count(*)::text from public.get_office_identity()$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('unknown'),'session_id',pg_temp.sid('unknown'),'role','authenticated')::text,true);
select pg_temp.verify('unknown user rejected',$q$select count(*)::text from public.get_office_identity()$q$,'0');
reset role;
select pg_temp.verify('applicant did not gain approval or points',$q$select (role='client' and account_kind='agent' and points=0)::text from public.profiles where id=pg_temp.uid('applicant')$q$,'true');
select pg_temp.verify('approved agent balance unchanged',$q$select (role='agent' and points=25)::text from public.profiles where id=pg_temp.uid('agent')$q$,'true');
select jsonb_build_object('total',count(*),'passed',count(*) filter(where passed),'results',jsonb_agg(to_jsonb(r))) as tests from results r;
rollback;
