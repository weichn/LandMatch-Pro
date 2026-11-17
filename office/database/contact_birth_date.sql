alter table public.contacts add column birth_date date;
alter table public.contacts add constraint contacts_birth_date_valid
 check (birth_date is null or (isfinite(birth_date) and birth_date >= date '0001-01-01'
 and birth_date <= (current_timestamp at time zone 'Asia/Taipei')::date));
comment on column public.contacts.birth_date is 'Civil birth date. UI accepts ROC dates, storage uses Gregorian date without time zone. Unknown stays NULL; tenant RLS applies.';
