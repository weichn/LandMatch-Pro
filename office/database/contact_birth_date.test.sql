begin;
create temporary table f(key text primary key,id uuid default gen_random_uuid());
insert into f(key) values('a'),('b'),('staff'),('viewer'),('outsider'),('suspended'),('oa'),('ob'),('ca'),('cb'),('request'),('newrequest');
grant select on f to authenticated,anon;
create function pg_temp.uid(k text) returns uuid language sql as $$select id from pg_temp.f where key=k$$;
create temporary table fixture(payload jsonb);
insert into fixture values('{"version":1,"pageCount":1,"properties":[{"kind":"土地","fields":[{"key":"district","value":"測試區","page":1,"reviewed":true},{"key":"section","value":"測試段","page":1,"reviewed":true},{"key":"number","value":"0001-0000","page":1,"reviewed":true},{"key":"area","value":"100.00","page":1,"reviewed":true}],"owners":[{"fields":[{"key":"name","value":"測**","page":1,"reviewed":true}]}],"common":[],"rights":[]}]}');
grant select on fixture to authenticated,anon;
create function pg_temp.payload() returns jsonb language sql as $$select payload from pg_temp.fixture$$;
create temporary table results(label text,passed boolean,actual text);
grant insert,select on results to authenticated,anon;
create function pg_temp.verify(label text,q text,expected text) returns void language plpgsql security invoker as $$
declare actual text;
begin begin execute q into actual; exception when others then actual:=SQLSTATE; end;
insert into pg_temp.results values(label,actual is not distinct from expected,actual);end$$;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous)
 select id,'authenticated','authenticated',id::text||'@example.invalid',now(),false from f where key in('a','b','staff','viewer','outsider','suspended');
insert into public.offices(id,name) values(pg_temp.uid('oa'),'TRANSCRIPT TEST A'),(pg_temp.uid('ob'),'TRANSCRIPT TEST B');
insert into public.office_members(office_id,user_id,role,status) values
 (pg_temp.uid('oa'),pg_temp.uid('a'),'owner','active'),(pg_temp.uid('ob'),pg_temp.uid('b'),'owner','active'),
 (pg_temp.uid('oa'),pg_temp.uid('staff'),'staff','active'),(pg_temp.uid('oa'),pg_temp.uid('viewer'),'viewer','active'),(pg_temp.uid('oa'),pg_temp.uid('suspended'),'staff','suspended');
insert into public.office_cases(id,office_id,case_number,title) values(pg_temp.uid('ca'),pg_temp.uid('oa'),'TEST-A','Test A'),(pg_temp.uid('cb'),pg_temp.uid('ob'),'TEST-B','Test B');
insert into public.contacts(id,office_id,display_name) values(pg_temp.uid('request'),pg_temp.uid('oa'),'TEST A'),(pg_temp.uid('newrequest'),pg_temp.uid('ob'),'TEST B');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('a'),'role','authenticated')::text,true);
select pg_temp.verify('owner update birth date',$q$with r as(update public.contacts set birth_date=date '2000-02-29' where id=pg_temp.uid('request') returning birth_date) select birth_date::text from r$q$,'2000-02-29');
select pg_temp.verify('future date denied',$q$update public.contacts set birth_date=current_date+2 where id=pg_temp.uid('request')$q$,'23514');
select pg_temp.verify('infinite date denied',$q$update public.contacts set birth_date='infinity' where id=pg_temp.uid('request')$q$,'23514');
select pg_temp.verify('invalid calendar date denied',$q$update public.contacts set birth_date='2001-02-29' where id=pg_temp.uid('request')$q$,'22008');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('b'),'role','authenticated')::text,true);
select pg_temp.verify('cross tenant date hidden',$q$select count(*)::text from public.contacts where id=pg_temp.uid('request')$q$,'0');
select pg_temp.verify('cross tenant date update denied',$q$with r as(update public.contacts set birth_date=null where id=pg_temp.uid('request') returning id) select count(*)::text from r$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('viewer'),'role','authenticated')::text,true);
select pg_temp.verify('viewer reads birth date',$q$select birth_date::text from public.contacts where id=pg_temp.uid('request')$q$,'2000-02-29');
select pg_temp.verify('viewer cannot update',$q$with r as(update public.contacts set birth_date=null where id=pg_temp.uid('request') returning id) select count(*)::text from r$q$,'0');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('outsider'),'role','authenticated')::text,true);
select pg_temp.verify('non member hidden',$q$select count(*)::text from public.contacts$q$,'0');
reset role;
set local role anon;
select pg_temp.verify('anon denied',$q$select birth_date::text from public.contacts$q$,'42501');
reset role;
select jsonb_build_object('total',count(*),'passed',count(*) filter(where passed),'failures',coalesce(jsonb_agg(to_jsonb(r)) filter(where not passed),'[]'::jsonb)) as tests from results r;
rollback;