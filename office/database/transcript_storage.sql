-- Additive case-bound, immutable transcript records. No legacy table changes.
-- No raw PDF, raw OCR text, or identity-number fields are stored.
create function public.office_valid_transcript(v jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare p jsonb; g jsonb; f jsonb; groups jsonb; allowed text[]; category text;
        seen text[]; propkeys text[] := '{}'; identity text; n integer;
begin
 if v is null or pg_catalog.jsonb_typeof(v)<>'object' or pg_catalog.octet_length(v::text)>250000
    or v-'version'-'pageCount'-'properties'<>'{}'::jsonb or v->'version' is distinct from '1'::jsonb
    or coalesce(v->>'pageCount','') !~ '^[0-9]{1,2}$' then return false; end if;
 n := (v->>'pageCount')::integer;
 if n not between 1 and 40 or pg_catalog.jsonb_typeof(v->'properties') is distinct from 'array'
    or pg_catalog.jsonb_array_length(v->'properties') not between 1 and 30 then return false; end if;
 for p in select value from pg_catalog.jsonb_array_elements(v->'properties') loop
  if pg_catalog.jsonb_typeof(p)<>'object' or p-'kind'-'fields'-'owners'-'common'-'rights'<>'{}'::jsonb
     or coalesce(p->>'kind','') not in ('土地','建物') then return false; end if;
  foreach category in array array['fields','owners','common','rights'] loop
   if pg_catalog.jsonb_typeof(p->category) is distinct from 'array'
      or pg_catalog.jsonb_array_length(p->category)>100 then return false; end if;
   if category='fields' then
    groups:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('fields',p->'fields'));
    allowed:=case when p->>'kind'='土地' then array['district','section','number','issued','area','zone','category','announced']
       else array['district','section','number','issued','address','land','use','material','floors','area','floor','floorArea','completed','annex','annexArea'] end;
   else
    groups:=p->category;
    allowed:=case category when 'owners' then array['sequence','name','address','share','registered']
       when 'common' then array['number','area','share']
       else array['sequence','type','creditor','amount','certificate','jointLand','jointBuilding'] end;
   end if;
   for g in select value from pg_catalog.jsonb_array_elements(groups) loop
    if pg_catalog.jsonb_typeof(g)<>'object' or g-'fields'<>'{}'::jsonb
       or pg_catalog.jsonb_typeof(g->'fields') is distinct from 'array'
       or pg_catalog.jsonb_array_length(g->'fields') not between 1 and 25 then return false; end if;
    seen:='{}';
    for f in select value from pg_catalog.jsonb_array_elements(g->'fields') loop
     if pg_catalog.jsonb_typeof(f)<>'object' or f-'key'-'value'-'page'-'reviewed'<>'{}'::jsonb
        or coalesce(f->>'key','') <> all(allowed) or (f->>'key')=any(seen)
        or pg_catalog.jsonb_typeof(f->'value') is distinct from 'string'
        or pg_catalog.length(pg_catalog.btrim(f->>'value')) not between 1 and 1000
        or f->'reviewed' is distinct from 'true'::jsonb
        or coalesce(f->>'page','') !~ '^[0-9]{1,2}$' then return false; end if;
     if (f->>'page')::integer not between 1 and n then return false; end if;
     -- Reject common Taiwan national / resident ID formats even in arbitrary values.
     if pg_catalog.regexp_replace(pg_catalog.upper(f->>'value'),'[[:space:]-]','','g') ~ '[A-Z]([0-9]{9}|[A-D][0-9]{8})' then return false; end if;
     seen:=pg_catalog.array_append(seen,f->>'key');
    end loop;
    if category='fields' and not (seen @> array['district','section','number','area']) then return false; end if;
   end loop;
  end loop;
  select pg_catalog.string_agg(x->>'value','|' order by x->>'key') into identity
   from pg_catalog.jsonb_array_elements(p->'fields') x where x->>'key' in ('district','section','number');
  identity:=(p->>'kind')||'|'||identity;
  if identity=any(propkeys) then return false; end if;
  propkeys:=pg_catalog.array_append(propkeys,identity);
 end loop;
 return true;
exception when others then return false;
end; $$;
revoke all on function public.office_valid_transcript(jsonb) from public,anon;
grant execute on function public.office_valid_transcript(jsonb) to authenticated,service_role;

create table public.office_case_transcripts (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 case_id uuid not null,
 payload jsonb not null check(public.office_valid_transcript(payload)),
 fingerprint text not null,
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 foreign key(office_id,case_id) references public.office_cases(office_id,id) on delete restrict,
 unique(office_id,case_id,fingerprint)
);
create index office_case_transcripts_author_idx on public.office_case_transcripts(created_by);
create index office_case_transcripts_case_date_idx on public.office_case_transcripts(office_id,case_id,created_at desc);
alter table public.office_case_transcripts enable row level security;
alter table public.office_case_transcripts force row level security;
revoke all on public.office_case_transcripts from public,anon,authenticated;
grant select on public.office_case_transcripts to authenticated;
grant insert(id,office_id,case_id,payload) on public.office_case_transcripts to authenticated;
grant all on public.office_case_transcripts to service_role;
create policy office_case_transcripts_read on public.office_case_transcripts for select to authenticated
 using(office_id in(select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy office_case_transcripts_insert on public.office_case_transcripts for insert to authenticated
 with check(created_by=(select auth.uid()) and office_id in(select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in('owner','admin','staff')));
create trigger office_case_transcripts_guard before insert or update on public.office_case_transcripts
 for each row execute function office_private.guard_row();
create function office_private.transcript_fingerprint() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 NEW.fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(NEW.payload::text,'UTF8')),'hex');
 return NEW;
end; $$;
revoke all on function office_private.transcript_fingerprint() from public,anon,authenticated;
create trigger office_case_transcripts_hash before insert or update on public.office_case_transcripts
 for each row execute function office_private.transcript_fingerprint();
comment on table public.office_case_transcripts is 'Immutable reviewed structured transcript snapshots attached to an Office case. No raw PDF, ID numbers, guessed identities or automatic contact merging. Client updates/deletes are not granted.';

create function public.office_save_transcript(p_office_id uuid,p_request_id uuid,p_payload jsonb,
 p_case_id uuid default null,p_case_number text default null,p_title text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing public.office_case_transcripts; target_case uuid; target_number text; record_id uuid;
begin
 if auth.uid() is null or p_request_id is null or not exists(select 1 from public.office_members m
  where m.user_id=auth.uid() and m.office_id=p_office_id and m.status='active' and m.role in('owner','admin','staff')) then
  raise exception 'not authorized' using errcode='42501';
 end if;
 if not public.office_valid_transcript(p_payload) then raise exception 'invalid reviewed transcript' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_office_id::text||p_request_id::text,0));
 select * into existing from public.office_case_transcripts where id=p_request_id and office_id=p_office_id;
 if found then
  if existing.created_by<>auth.uid() or existing.payload<>p_payload or (p_case_id is not null and existing.case_id<>p_case_id) then
   raise exception 'request identity already used' using errcode='22023';
  end if;
  select case_number into target_number from public.office_cases where office_id=p_office_id and id=existing.case_id;
  return pg_catalog.jsonb_build_object('record_id',existing.id,'case_id',existing.case_id,'case_number',target_number,'duplicate',true);
 end if;
 if p_case_id is null then
  if p_case_number is null or p_title is null then raise exception 'case fields required' using errcode='22023'; end if;
  insert into public.office_cases(office_id,case_number,title,case_type,status,opened_on)
    values(p_office_id,pg_catalog.btrim(p_case_number),pg_catalog.btrim(p_title),'謄本匯入','active',current_date)
    returning id,case_number into target_case,target_number;
 else
  select id,case_number into target_case,target_number from public.office_cases where id=p_case_id and office_id=p_office_id;
  if not found then raise exception 'case unavailable' using errcode='42501'; end if;
 end if;
 -- Unique index handles concurrent same-document submissions to the same case.
 insert into public.office_case_transcripts(id,office_id,case_id,payload)
  values(p_request_id,p_office_id,target_case,p_payload)
  on conflict(office_id,case_id,fingerprint) do nothing returning id into record_id;
 if record_id is null then
  select id into record_id from public.office_case_transcripts where office_id=p_office_id and case_id=target_case
   and fingerprint=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload::text,'UTF8')),'hex');
 end if;
 return pg_catalog.jsonb_build_object('record_id',record_id,'case_id',target_case,'case_number',target_number,'duplicate',record_id<>p_request_id);
end; $$;
revoke all on function public.office_save_transcript(uuid,uuid,jsonb,uuid,text,text) from public,anon;
grant execute on function public.office_save_transcript(uuid,uuid,jsonb,uuid,text,text) to authenticated;

