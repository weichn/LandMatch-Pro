begin;
create temporary table f(key text primary key,id uuid default gen_random_uuid());
insert into f(key) values ('a'),('b'),('unverified'),('anonymous'),('banned'),('suspended');
grant select on f to authenticated,anon;
create function pg_temp.uid(k text) returns uuid language sql as $$select id from pg_temp.f where key=k$$;
create temporary table results(label text,passed boolean,actual text);
grant insert,select on results to authenticated,anon;
create function pg_temp.verify(label text,q text,expected text) returns void language plpgsql security invoker as $$
declare actual text;
begin begin execute q into actual; exception when others then actual:=SQLSTATE; end;
insert into pg_temp.results values(label,actual is not distinct from expected,actual);end$$;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,banned_until)
select id,'authenticated','authenticated',id::text||'@example.invalid',
case when key='unverified' then null else now() end,key='anonymous',
case when key='banned' then now()+interval '1 day' else null end from f;
set local role anon;
select pg_temp.verify('anon cannot call bootstrap',$q$select public.office_create('A')::text$q$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select pg_temp.verify('missing identity denied',$q$select public.office_create('A')::text$q$,'42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('unverified'),'role','authenticated')::text,true);
select pg_temp.verify('unverified denied',$q$select public.office_create('A')::text$q$,'42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('anonymous'),'role','authenticated')::text,true);
select pg_temp.verify('anonymous denied',$q$select public.office_create('A')::text$q$,'42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('banned'),'role','authenticated')::text,true);
select pg_temp.verify('banned denied',$q$select public.office_create('A')::text$q$,'42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('a'),'role','authenticated')::text,true);
select pg_temp.verify('blank office name denied',$q$select public.office_create(' ')::text$q$,'22023');
select pg_temp.verify('long office name denied',$q$select public.office_create(repeat('a',201))::text$q$,'22023');
select pg_temp.verify('verified creates first office',$q$select (public.office_create('TEST Office A') is not null)::text$q$,'true');
select pg_temp.verify('creator owns exactly one office',$q$select count(*)::text from public.office_members where role='owner' and user_id=auth.uid()$q$,'1');
select pg_temp.verify('retry returns same office',$q$select (public.office_create('retry')=(select office_id from public.office_members where user_id=auth.uid()))::text$q$,'true');
select pg_temp.verify('direct membership insert still denied',$q$insert into public.office_members(office_id,user_id) values((select id from public.offices limit 1),pg_temp.uid('b')) returning id::text$q$,'42501');
select pg_temp.verify('trigger function not executable',$q$select has_function_privilege(current_user,'office_private.guard_row()','execute')::text$q$,'false');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('b'),'role','authenticated')::text,true);
select pg_temp.verify('other user sees no office',$q$select count(*)::text from public.offices$q$,'0');
select pg_temp.verify('second user gets own office',$q$select (public.office_create('TEST Office B') is not null)::text$q$,'true');
select pg_temp.verify('second user sees only own office',$q$select count(*)::text from public.offices$q$,'1');
reset role;
insert into public.office_members(office_id,user_id,status) select office_id,pg_temp.uid('suspended'),'suspended' from public.office_members where user_id=pg_temp.uid('a');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('suspended'),'role','authenticated')::text,true);
select pg_temp.verify('suspended member cannot bootstrap',$q$select public.office_create('bypass suspension')::text$q$,'42501');
reset role;
select jsonb_build_object('total',count(*),'passed',count(*) filter(where passed),'results',jsonb_agg(to_jsonb(r))) as tests from results r;
rollback;
