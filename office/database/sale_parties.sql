-- Case roles reference the existing tenant contact directory. No identity-number storage.
create table public.office_case_parties (
 id uuid primary key default gen_random_uuid(),
 office_id uuid not null references public.offices(id) on delete restrict,
 case_id uuid not null,
 contact_id uuid not null,
 role text not null check (role in ('buyer','seller')),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 foreign key (office_id,case_id) references public.office_cases(office_id,id) on delete restrict,
 foreign key (office_id,contact_id) references public.contacts(office_id,id) on delete restrict,
 unique (office_id,case_id,contact_id,role)
);
create index office_case_parties_contact_idx on public.office_case_parties(office_id,contact_id);
alter table public.office_case_parties enable row level security;
alter table public.office_case_parties force row level security;
revoke all on public.office_case_parties from public,anon,authenticated;
grant select,delete on public.office_case_parties to authenticated;
grant insert(id,office_id,case_id,contact_id,role) on public.office_case_parties to authenticated;
grant all on public.office_case_parties to service_role;
create policy office_case_parties_read on public.office_case_parties for select to authenticated
 using(office_id in(select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active'));
create policy office_case_parties_insert on public.office_case_parties for insert to authenticated
 with check(office_id in(select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in('owner','admin','staff')));
create policy office_case_parties_delete on public.office_case_parties for delete to authenticated
 using(office_id in(select m.office_id from public.office_members m where m.user_id=(select auth.uid()) and m.status='active' and m.role in('owner','admin','staff')));
create trigger office_case_parties_guard before insert or update on public.office_case_parties
 for each row execute function office_private.guard_row();
comment on table public.office_case_parties is 'Explicit buyer/seller contact assignments. No inferred identity, transfer shares, or national ID data. Removing a role does not delete the contact.';
