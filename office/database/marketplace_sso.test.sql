-- Isolated Auth, membership and short-lived login fixtures; entire transaction rolls back.
begin;
create temporary table f(key text primary key,id uuid default gen_random_uuid(),source_id uuid default gen_random_uuid());
insert into f(key) values ('fresh'),('owner'),('staff'),('viewer'),('suspended'),('unverified'),('banned'),('deleted'),('anonymous'),('other'),('rate'),('absent');
grant select on f to service_role, authenticated, anon;
create function pg_temp.uid(k text) returns uuid language sql as $$select id from pg_temp.f where key=k$$;
create function pg_temp.sid(k text) returns uuid language sql as $$select source_id from pg_temp.f where key=k$$;
create function pg_temp.email(k text) returns text language sql as $$select id::text||'@office-sso.example.invalid' from pg_temp.f where key=k$$;
create temporary table results(label text,passed boolean);
grant insert,select on results to service_role,authenticated,anon;
create function pg_temp.verify(label text,q text,expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute q into actual; exception when others then actual:=SQLSTATE; end;
  if actual is distinct from expected then raise exception 'Fixture failed: %, expected %, received %',label,expected,actual; end if;
  insert into pg_temp.results values(label,true);
end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous,banned_until,deleted_at)
select id,'authenticated','authenticated',pg_temp.email(key),
  case when key='unverified' then null else now() end,key='anonymous',
  case when key='banned' then now()+interval '1 day' else null end,
  case when key='deleted' then now() else null end from f where key<>'absent';
insert into public.offices(name) values('Fixture legacy office') returning set_config('test.sso.legacy_office',id::text,true);
insert into public.office_members(office_id,user_id,role,status) values
  (current_setting('test.sso.legacy_office')::uuid,pg_temp.uid('owner'),'owner','active'),
  (current_setting('test.sso.legacy_office')::uuid,pg_temp.uid('staff'),'staff','active'),
  (current_setting('test.sso.legacy_office')::uuid,pg_temp.uid('viewer'),'viewer','active'),
  (current_setting('test.sso.legacy_office')::uuid,pg_temp.uid('suspended'),'staff','suspended');

select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.verify('anonymous lookup forbidden',$q$select public.office_marketplace_lookup(pg_temp.sid('fresh'),pg_temp.email('fresh'))::text$q$,'42501');
select pg_temp.verify('anonymous private mapping unreadable',$q$select count(*)::text from office_private.marketplace_identities$q$,'42501');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('fresh'),'role','authenticated')::text,true);
select pg_temp.verify('ordinary user lookup forbidden',$q$select public.office_marketplace_lookup(pg_temp.sid('fresh'),pg_temp.email('fresh'))::text$q$,'42501');
select pg_temp.verify('ordinary user cannot mint an Office mapping',$q$select public.office_marketplace_link(pg_temp.sid('fresh'),pg_temp.uid('fresh'),pg_temp.email('fresh'),'Bad')::text$q$,'42501');
select pg_temp.verify('ordinary user cannot issue code',$q$select public.office_marketplace_issue_code(pg_temp.sid('fresh'),pg_temp.uid('fresh'),repeat('a',64),repeat('A',43))::text$q$,'42501');
select pg_temp.verify('ordinary user cannot consume code',$q$select public.office_marketplace_consume_code(repeat('a',64),repeat('A',43))::text$q$,'42501');
set local role service_role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select pg_temp.verify('service DB role also requires trusted service JWT context',$q$select public.office_marketplace_lookup(pg_temp.sid('fresh'),pg_temp.email('fresh'))::text$q$,'42501');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.verify('new unmatched email returns null',$q$select ((public.office_marketplace_lookup(pg_temp.sid('absent'),pg_temp.email('absent')))->>'office_user_id' is null)::text$q$,'true');
select pg_temp.verify('verified same-email existing account found',$q$select ((public.office_marketplace_lookup(pg_temp.sid('fresh'),pg_temp.email('fresh')))->>'office_user_id'=pg_temp.uid('fresh')::text)::text$q$,'true');
select set_config('test.sso.fresh_office',public.office_marketplace_link(pg_temp.sid('fresh'),pg_temp.uid('fresh'),pg_temp.email('fresh'),'Fixture fresh office')->>'office_id',true);
select pg_temp.verify('fresh professional gets exactly one active owner membership',$q$select (count(*)=1 and bool_and(role='owner' and status='active'))::text from public.office_members where user_id=pg_temp.uid('fresh')$q$,'true');
select pg_temp.verify('retry returns original workspace without creating another',$q$select ((public.office_marketplace_link(pg_temp.sid('fresh'),pg_temp.uid('fresh'),pg_temp.email('fresh'),'Changed label'))->>'office_id'=current_setting('test.sso.fresh_office'))::text$q$,'true');
select pg_temp.verify('retry does not overwrite office business label',$q$select name from public.offices where id=current_setting('test.sso.fresh_office')::uuid$q$,'Fixture fresh office');
select pg_temp.verify('source email change retains mapped Office UUID',$q$select ((public.office_marketplace_lookup(pg_temp.sid('fresh'),pg_temp.email('other')))->>'office_user_id'=pg_temp.uid('fresh')::text)::text$q$,'true');
select pg_temp.verify('mapped link accepts changed source email without reassignment',$q$select ((public.office_marketplace_link(pg_temp.sid('fresh'),pg_temp.uid('fresh'),pg_temp.email('other'),'Changed'))->>'office_id'=current_setting('test.sso.fresh_office'))::text$q$,'true');
select pg_temp.verify('source cannot be reassigned to another Office user',$q$select public.office_marketplace_link(pg_temp.sid('fresh'),pg_temp.uid('other'),pg_temp.email('other'),'Bad')::text$q$,'23505');
select pg_temp.verify('Office user cannot be linked to a second source',$q$select public.office_marketplace_link(pg_temp.sid('other'),pg_temp.uid('fresh'),pg_temp.email('fresh'),'Bad')::text$q$,'23505');
select pg_temp.verify('first link rejects mismatched verified email',$q$select public.office_marketplace_link(pg_temp.sid('other'),pg_temp.uid('other'),pg_temp.email('owner'),'Bad')::text$q$,'23505');
select pg_temp.verify('legacy owner keeps original office',$q$select ((public.office_marketplace_link(pg_temp.sid('owner'),pg_temp.uid('owner'),pg_temp.email('owner'),'Do not replace'))->>'office_id'=current_setting('test.sso.legacy_office'))::text$q$,'true');
select pg_temp.verify('staff keeps original office',$q$select ((public.office_marketplace_link(pg_temp.sid('staff'),pg_temp.uid('staff'),pg_temp.email('staff'),'Do not replace'))->>'office_id'=current_setting('test.sso.legacy_office'))::text$q$,'true');
select pg_temp.verify('viewer keeps original office',$q$select ((public.office_marketplace_link(pg_temp.sid('viewer'),pg_temp.uid('viewer'),pg_temp.email('viewer'),'Do not replace'))->>'office_id'=current_setting('test.sso.legacy_office'))::text$q$,'true');
select pg_temp.verify('staff and viewer are never promoted',$q$select (count(*)=2 and bool_and((user_id=pg_temp.uid('staff') and role='staff') or (user_id=pg_temp.uid('viewer') and role='viewer')))::text from public.office_members where user_id in(pg_temp.uid('staff'),pg_temp.uid('viewer'))$q$,'true');
select pg_temp.verify('unverified legacy account cannot be linked',$q$select public.office_marketplace_lookup(pg_temp.sid('unverified'),pg_temp.email('unverified'))::text$q$,'42501');
select pg_temp.verify('unverified legacy account cannot be provisioned',$q$select public.office_marketplace_link(pg_temp.sid('unverified'),pg_temp.uid('unverified'),pg_temp.email('unverified'),'Bad')::text$q$,'42501');
select pg_temp.verify('banned Office account cannot be linked',$q$select public.office_marketplace_lookup(pg_temp.sid('banned'),pg_temp.email('banned'))::text$q$,'42501');
select pg_temp.verify('deleted Office account cannot be linked',$q$select public.office_marketplace_lookup(pg_temp.sid('deleted'),pg_temp.email('deleted'))::text$q$,'42501');
select pg_temp.verify('anonymous Office account cannot be linked',$q$select public.office_marketplace_lookup(pg_temp.sid('anonymous'),pg_temp.email('anonymous'))::text$q$,'42501');
select pg_temp.verify('suspended member cannot create a replacement office',$q$select public.office_marketplace_link(pg_temp.sid('suspended'),pg_temp.uid('suspended'),pg_temp.email('suspended'),'Bad')::text$q$,'42501');
select pg_temp.verify('malformed issue code rejected',$q$select public.office_marketplace_issue_code(pg_temp.sid('fresh'),pg_temp.uid('fresh'),'raw-token',repeat('A',43))::text$q$,'22023');
select pg_temp.verify('unmapped source cannot issue code',$q$select public.office_marketplace_issue_code(pg_temp.sid('absent'),pg_temp.uid('fresh'),repeat('f',64),repeat('A',43))::text$q$,'42501');
select pg_temp.verify('valid code issued',$q$select public.office_marketplace_issue_code(pg_temp.sid('fresh'),pg_temp.uid('fresh'),repeat('a',64),repeat('A',43))::text$q$,'true');
select pg_temp.verify('code lifetime fixed to 120 seconds',$q$select ((expires_at-created_at)=interval '120 seconds')::text from office_private.marketplace_login_codes where code_hash=repeat('a',64)$q$,'true');
select pg_temp.verify('wrong PKCE challenge rejected without consuming code',$q$select public.office_marketplace_consume_code(repeat('a',64),repeat('B',43))::text$q$,'42501');
select pg_temp.verify('correct PKCE consumes and returns matching identity',$q$select ((public.office_marketplace_consume_code(repeat('a',64),repeat('A',43)))->>'office_user_id'=pg_temp.uid('fresh')::text)::text$q$,'true');
select pg_temp.verify('consumed code cannot be replayed',$q$select public.office_marketplace_consume_code(repeat('a',64),repeat('A',43))::text$q$,'42501');
select public.office_marketplace_issue_code(pg_temp.sid('fresh'),pg_temp.uid('fresh'),repeat('b',64),repeat('A',43));
update office_private.marketplace_login_codes set expires_at=now()-interval '1 second' where code_hash=repeat('b',64);
select pg_temp.verify('expired code cannot be consumed',$q$select public.office_marketplace_consume_code(repeat('b',64),repeat('A',43))::text$q$,'42501');
select public.office_marketplace_issue_code(pg_temp.sid('fresh'),pg_temp.uid('fresh'),repeat('c',64),repeat('A',43));
reset role;
update auth.users set banned_until=now()+interval '1 day' where id=pg_temp.uid('fresh');
set local role service_role;
select pg_temp.verify('ban after issue blocks consume',$q$select public.office_marketplace_consume_code(repeat('c',64),repeat('A',43))::text$q$,'42501');
reset role;
update auth.users set banned_until=null where id=pg_temp.uid('fresh');
update public.office_members set status='suspended' where user_id=pg_temp.uid('fresh');
set local role service_role;
select pg_temp.verify('suspension after issue blocks consume',$q$select public.office_marketplace_consume_code(repeat('c',64),repeat('A',43))::text$q$,'42501');
reset role;
update public.office_members set status='active' where user_id=pg_temp.uid('fresh');
set local role service_role;
select public.office_marketplace_link(pg_temp.sid('rate'),pg_temp.uid('rate'),pg_temp.email('rate'),'Fixture rate office');
do $$begin for i in 1..10 loop perform public.office_marketplace_issue_code(pg_temp.sid('rate'),pg_temp.uid('rate'),lpad(to_hex(i),64,'0'),repeat('R',43)); end loop; end$$;
select public.office_marketplace_consume_code(lpad(to_hex(1),64,'0'),repeat('R',43));
select pg_temp.verify('rate window includes consumed codes and caps ten requests',$q$select public.office_marketplace_issue_code(pg_temp.sid('rate'),pg_temp.uid('rate'),lpad(to_hex(11),64,'0'),repeat('R',43))::text$q$,'54000');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid('staff'),'role','authenticated')::text,true);
select pg_temp.verify('staff still sees own membership without promotion',$q$select role from public.office_members where user_id=auth.uid()$q$,'staff');
select pg_temp.verify('foreign workspace remains invisible',$q$select count(*)::text from public.offices where id=current_setting('test.sso.fresh_office')::uuid$q$,'0');
select pg_temp.verify('authenticated cannot inspect private mappings',$q$select count(*)::text from office_private.marketplace_identities$q$,'42501');
select pg_temp.verify('authenticated cannot inspect login hashes',$q$select count(*)::text from office_private.marketplace_login_codes$q$,'42501');
reset role;
select pg_temp.verify('unverified account stayed unverified with no membership',$q$select (email_confirmed_at is null and not exists(select 1 from public.office_members where user_id=u.id))::text from auth.users u where id=pg_temp.uid('unverified')$q$,'true');
select jsonb_build_object('total',count(*),'passed',count(*) filter(where passed),'results',jsonb_agg(to_jsonb(r))) as tests from results r;
rollback;
