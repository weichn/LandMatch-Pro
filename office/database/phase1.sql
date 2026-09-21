-- LandMatch Pro Office Phase 1. Additive only; legacy tables are untouched.
create schema office_private;
revoke all on schema office_private from public, anon, authenticated;

create table public.offices (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 200),
 phone text, email text, address text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.office_members (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null default 'staff' check (role in ('owner','admin','staff','viewer')),
 status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (office_id,user_id),
 unique (office_id,id)
);
create index office_members_user_office_idx on public.office_members(user_id,office_id);
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 name text not null check (length(btrim(name)) between 1 and 200),
 registration_number text,
 phone text, email text, address text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (office_id,id)
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 organization_id uuid,
 display_name text not null check (length(btrim(display_name)) between 1 and 200),
 phone text, email text, address text,
 national_id_encrypted bytea,
 national_id_hash bytea,
 national_id_key_id text,
 national_id_hash_key_id text,
 national_id_format_version smallint,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (office_id,id),
 foreign key (office_id,organization_id) references public.organizations(office_id,id) on delete restrict,
 constraint contacts_national_id_disabled_until_kms check (
 national_id_encrypted is null and national_id_hash is null and
 national_id_key_id is null and national_id_hash_key_id is null and national_id_format_version is null)
);
create index contacts_office_organization_idx on public.contacts(office_id,organization_id);
create index contacts_office_name_idx on public.contacts(office_id,display_name);
comment on column public.contacts.national_id_encrypted is 'RESERVED, disabled by CHECK until application authenticated encryption, external KMS, key rotation and audited access are implemented. Never store plaintext.';
comment on column public.contacts.national_id_hash is 'RESERVED, disabled. Future tenant-scoped keyed HMAC blind index; never an unkeyed hash of predictable identity numbers.';
comment on column public.contacts.national_id_key_id is 'External KMS key reference only. Never store key material here.';
comment on column public.contacts.national_id_hash_key_id is 'Separate external HMAC key reference for blind-index rotation.';
comment on column public.contacts.national_id_format_version is 'Future versioned authenticated encryption envelope, including nonce and tag.';
create table public.office_cases (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 case_number text not null check (length(btrim(case_number)) between 1 and 100),
 title text not null check (length(btrim(title)) between 1 and 300),
 case_type text not null default 'other' check (length(btrim(case_type)) between 1 and 100),
 status text not null default 'draft' check (status in ('draft','active','on_hold','completed','cancelled')),
 primary_contact_id uuid,
 organization_id uuid,
 assigned_member_id uuid,
 opened_on date,
 closed_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (office_id,id),
 unique (office_id,case_number),
 foreign key (office_id,primary_contact_id) references public.contacts(office_id,id) on delete restrict,
 foreign key (office_id,organization_id) references public.organizations(office_id,id) on delete restrict,
 foreign key (office_id,assigned_member_id) references public.office_members(office_id,id) on delete restrict,
 check (closed_on is null or (opened_on is not null and closed_on >= opened_on))
);
create index office_cases_office_contact_idx on public.office_cases(office_id,primary_contact_id);
create index office_cases_office_organization_idx on public.office_cases(office_id,organization_id);
create index office_cases_office_assignee_idx on public.office_cases(office_id,assigned_member_id);
create index office_cases_office_status_updated_idx on public.office_cases(office_id,status,updated_at desc);

-- Invoker trigger: immutable identity/tenant/creation time; DB-controlled timestamps.
create function office_private.guard_row() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  if NEW.id is distinct from OLD.id or NEW.created_at is distinct from OLD.created_at then
   raise exception 'identity and created_at are immutable' using errcode='23514';
  end if;
  if TG_TABLE_NAME <> 'offices' then
   if NEW.office_id is distinct from OLD.office_id then
    raise exception 'office_id is immutable' using errcode='23514';
   end if;
  end if;
  if TG_TABLE_NAME = 'office_members' then
   if NEW.user_id is distinct from OLD.user_id then
    raise exception 'member user_id is immutable' using errcode='23514';
   end if;
  end if;
 else
  NEW.created_at := statement_timestamp();
 end if;
 NEW.updated_at := statement_timestamp();
 return NEW;
end;
$$;
revoke all on function office_private.guard_row() from public, anon, authenticated;

-- No client membership writes or SECURITY DEFINER helpers.
-- Self-membership SELECT avoids recursive membership policies.
create policy office_members_read_self on public.office_members for select to authenticated
 using (user_id=(select auth.uid()) and status='active'
 and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true');
comment on table public.office_members is 'Phase 1: clients read only their own active memberships. Provisioning, roster management and role changes require a trusted server; never expose service_role to clients.';

alter table public.offices enable row level security;
alter table public.offices force row level security;
revoke all on public.offices from public,anon,authenticated;
grant select,insert,update,delete on public.offices to service_role;
create trigger offices_guard_row before insert or update on public.offices for each row execute function office_private.guard_row();

alter table public.office_members enable row level security;
alter table public.office_members force row level security;
revoke all on public.office_members from public,anon,authenticated;
grant select,insert,update,delete on public.office_members to service_role;
create trigger office_members_guard_row before insert or update on public.office_members for each row execute function office_private.guard_row();

alter table public.contacts enable row level security;
alter table public.contacts force row level security;
revoke all on public.contacts from public,anon,authenticated;
grant select,insert,update,delete on public.contacts to service_role;
create trigger contacts_guard_row before insert or update on public.contacts for each row execute function office_private.guard_row();

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
revoke all on public.organizations from public,anon,authenticated;
grant select,insert,update,delete on public.organizations to service_role;
create trigger organizations_guard_row before insert or update on public.organizations for each row execute function office_private.guard_row();

alter table public.office_cases enable row level security;
alter table public.office_cases force row level security;
revoke all on public.office_cases from public,anon,authenticated;
grant select,insert,update,delete on public.office_cases to service_role;
create trigger office_cases_guard_row before insert or update on public.office_cases for each row execute function office_private.guard_row();
grant select on public.office_members to authenticated;
grant select,update on public.offices to authenticated;
create policy offices_read on public.offices for select to authenticated using (id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy offices_update on public.offices for update to authenticated using (id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'))) with check (id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin')));
grant select,insert,update,delete on public.contacts to authenticated;
create policy contacts_select on public.contacts for select to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy contacts_insert on public.contacts for insert to authenticated with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy contacts_update on public.contacts for update to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff'))) with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy contacts_delete on public.contacts for delete to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin')));
grant select,insert,update,delete on public.organizations to authenticated;
create policy organizations_select on public.organizations for select to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy organizations_insert on public.organizations for insert to authenticated with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy organizations_update on public.organizations for update to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff'))) with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy organizations_delete on public.organizations for delete to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin')));
grant select,insert,update,delete on public.office_cases to authenticated;
create policy office_cases_select on public.office_cases for select to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy office_cases_insert on public.office_cases for insert to authenticated with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy office_cases_update on public.office_cases for update to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff'))) with check (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','staff')));
create policy office_cases_delete on public.office_cases for delete to authenticated using (office_id in (select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin')));

