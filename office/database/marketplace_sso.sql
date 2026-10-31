-- Target only: Office qkwfulonscvreudtroaw.
-- The trusted Edge function verifies the source JWT and self-only eligibility.
-- No credentials, source access tokens, refresh tokens, or raw login codes are stored here.
set local lock_timeout = '5s';

create table office_private.marketplace_identities (
  source_user_id uuid primary key,
  source_project text not null default 'avenejzzakocgmoszlto'
    check (source_project = 'avenejzzakocgmoszlto'),
  office_user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (source_user_id, office_user_id)
);
alter table office_private.marketplace_identities enable row level security;
revoke all on table office_private.marketplace_identities from public, anon, authenticated;
grant select, insert, update on table office_private.marketplace_identities to service_role;

create table office_private.marketplace_login_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  source_user_id uuid not null,
  office_user_id uuid not null,
  challenge text not null check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '120 seconds'),
  consumed_at timestamptz,
  foreign key (source_user_id, office_user_id)
    references office_private.marketplace_identities(source_user_id, office_user_id) on delete cascade
);
create index marketplace_login_codes_rate_idx
  on office_private.marketplace_login_codes(source_user_id, created_at desc);
create index marketplace_login_codes_cleanup_idx
  on office_private.marketplace_login_codes(created_at);
alter table office_private.marketplace_login_codes enable row level security;
revoke all on table office_private.marketplace_login_codes from public, anon, authenticated;
grant select, insert, update, delete on table office_private.marketplace_login_codes to service_role;

create function office_private.marketplace_assert_service()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce((select auth.jwt())->>'role', '') <> 'service_role' then
    raise exception 'service_forbidden' using errcode = '42501';
  end if;
end $$;
revoke all on function office_private.marketplace_assert_service() from public, anon, authenticated;
grant usage on schema office_private to service_role;
grant execute on function office_private.marketplace_assert_service() to service_role;

create function office_private.marketplace_assert_verified_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user auth.users;
begin
  perform office_private.marketplace_assert_service();
  select * into v_user from auth.users where id = p_user_id;
  if not found or v_user.is_anonymous is true or v_user.email is null
    or v_user.deleted_at is not null or (v_user.banned_until is not null and v_user.banned_until >= now()) then
    raise exception 'office_suspended' using errcode = '42501';
  end if;
  if v_user.email_confirmed_at is null then
    raise exception 'office_account_unverified' using errcode = '42501';
  end if;
end $$;
revoke all on function office_private.marketplace_assert_verified_user(uuid) from public, anon, authenticated;
grant execute on function office_private.marketplace_assert_verified_user(uuid) to service_role;

create function office_private.marketplace_lookup(p_source_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_office_user uuid;
  v_email text := lower(btrim(p_email));
  v_email_matches integer;
begin
  perform office_private.marketplace_assert_service();
  if p_source_id is null or v_email is null or length(v_email) not between 3 and 254
    or position('@' in v_email) < 2 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(30102026, hashtext(p_source_id::text));
  select m.office_user_id into v_office_user from office_private.marketplace_identities m
    where m.source_user_id = p_source_id;
  if v_office_user is null then
    select count(*), (array_agg(u.id))[1] into v_email_matches, v_office_user
      from auth.users u where lower(u.email) = v_email;
    if v_email_matches > 1 then
      raise exception 'identity_conflict' using errcode = '23505';
    end if;
    if v_office_user is null then return jsonb_build_object('office_user_id', null); end if;
    if exists(select 1 from office_private.marketplace_identities m
      where m.office_user_id = v_office_user and m.source_user_id <> p_source_id) then
      raise exception 'identity_conflict' using errcode = '23505';
    end if;
  end if;
  perform office_private.marketplace_assert_verified_user(v_office_user);
  if exists(select 1 from public.office_members m where m.user_id = v_office_user)
    and not exists(select 1 from public.office_members m where m.user_id = v_office_user and m.status = 'active') then
    raise exception 'membership_suspended' using errcode = '42501';
  end if;
  return jsonb_build_object('office_user_id', v_office_user);
end $$;
revoke all on function office_private.marketplace_lookup(uuid, text) from public, anon, authenticated;
grant execute on function office_private.marketplace_lookup(uuid, text) to service_role;

create function office_private.marketplace_link(
  p_source_id uuid, p_office_user_id uuid, p_email text, p_office_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_office uuid;
  v_user_email text;
  v_email text := lower(btrim(p_email));
  v_name text := coalesce(nullif(btrim(p_office_name), ''), '我的事務所');
begin
  perform office_private.marketplace_assert_service();
  if p_source_id is null or p_office_user_id is null or v_email is null
    or length(v_email) not between 3 and 254 or position('@' in v_email) < 2
    or length(v_name) > 200 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(30102026, hashtext(p_source_id::text));
  -- Coordinate with the existing first-office bootstrap lock as well.
  perform pg_advisory_xact_lock(16092026, hashtext(p_office_user_id::text));
  select m.office_user_id into v_existing from office_private.marketplace_identities m
    where m.source_user_id = p_source_id for update;
  if v_existing is not null and v_existing <> p_office_user_id then
    raise exception 'identity_conflict' using errcode = '23505';
  end if;
  perform office_private.marketplace_assert_verified_user(p_office_user_id);
  select u.email into v_user_email from auth.users u where u.id = p_office_user_id;
  if v_user_email is null or (v_existing is null and lower(v_user_email) <> v_email) then
    raise exception 'identity_conflict' using errcode = '23505';
  end if;
  if exists(select 1 from office_private.marketplace_identities m
    where m.office_user_id = p_office_user_id and m.source_user_id <> p_source_id) then
    raise exception 'identity_conflict' using errcode = '23505';
  end if;
  select m.office_id into v_office from public.office_members m
    where m.user_id = p_office_user_id and m.status = 'active'
    order by m.created_at, m.id limit 1;
  if v_office is null then
    if exists(select 1 from public.office_members m where m.user_id = p_office_user_id) then
      raise exception 'membership_suspended' using errcode = '42501';
    end if;
    insert into public.offices(name) values(v_name) returning id into v_office;
    insert into public.office_members(office_id, user_id, role, status)
      values(v_office, p_office_user_id, 'owner', 'active');
  end if;
  insert into office_private.marketplace_identities(source_user_id, office_user_id)
    values(p_source_id, p_office_user_id)
    on conflict (source_user_id) do update set last_used_at = now();
  return jsonb_build_object('office_user_id', p_office_user_id, 'office_id', v_office);
end $$;
revoke all on function office_private.marketplace_link(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function office_private.marketplace_link(uuid, uuid, text, text) to service_role;

create function office_private.marketplace_issue_code(
  p_source_id uuid, p_office_user_id uuid, p_code_hash text, p_challenge text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform office_private.marketplace_assert_service();
  if p_source_id is null or p_office_user_id is null or p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$' or p_challenge is null
    or p_challenge !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(30102026, hashtext(p_source_id::text));
  if not exists(select 1 from office_private.marketplace_identities m
    join auth.users u on u.id = m.office_user_id
    where m.source_user_id = p_source_id and m.office_user_id = p_office_user_id
      and u.is_anonymous is not true and u.email is not null and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
      and exists(select 1 from public.office_members om where om.user_id = u.id and om.status = 'active')) then
    raise exception 'office_suspended' using errcode = '42501';
  end if;
  -- Keep at least the whole 5-minute issuance window, even for consumed tickets.
  delete from office_private.marketplace_login_codes where created_at < now() - interval '10 minutes';
  if (select count(*) from office_private.marketplace_login_codes
    where source_user_id = p_source_id and created_at > now() - interval '5 minutes') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into office_private.marketplace_login_codes(code_hash, source_user_id, office_user_id, challenge)
    values(p_code_hash, p_source_id, p_office_user_id, p_challenge);
  update office_private.marketplace_identities set last_used_at = now() where source_user_id = p_source_id;
  return true;
end $$;
revoke all on function office_private.marketplace_issue_code(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function office_private.marketplace_issue_code(uuid, uuid, text, text) to service_role;

create function office_private.marketplace_consume_code(p_code_hash text, p_challenge text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ticket office_private.marketplace_login_codes;
begin
  perform office_private.marketplace_assert_service();
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
    or p_challenge is null or p_challenge !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_code' using errcode = '22023';
  end if;
  -- One UPDATE supplies the lock and compare-and-consume operation atomically.
  update office_private.marketplace_login_codes c set consumed_at = clock_timestamp()
    where c.code_hash = p_code_hash and c.challenge = p_challenge
      and c.consumed_at is null and c.expires_at > clock_timestamp()
      and exists(select 1 from office_private.marketplace_identities m
        join auth.users u on u.id = m.office_user_id
        where m.source_user_id = c.source_user_id and m.office_user_id = c.office_user_id
          and u.is_anonymous is not true and u.email is not null and u.email_confirmed_at is not null
          and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
          and exists(select 1 from public.office_members om where om.user_id = u.id and om.status = 'active'))
    returning c.* into v_ticket;
  if not found then
    raise exception 'invalid_code' using errcode = '42501';
  end if;
  return jsonb_build_object('office_user_id', v_ticket.office_user_id, 'source_user_id', v_ticket.source_user_id);
end $$;
revoke all on function office_private.marketplace_consume_code(text, text) from public, anon, authenticated;
grant execute on function office_private.marketplace_consume_code(text, text) to service_role;

create function public.office_marketplace_lookup(p_source_id uuid, p_email text)
returns jsonb language sql security invoker set search_path = '' as $$
  select office_private.marketplace_lookup(p_source_id, p_email)
$$;
create function public.office_marketplace_link(p_source_id uuid, p_office_user_id uuid, p_email text, p_office_name text)
returns jsonb language sql security invoker set search_path = '' as $$
  select office_private.marketplace_link(p_source_id, p_office_user_id, p_email, p_office_name)
$$;
create function public.office_marketplace_issue_code(p_source_id uuid, p_office_user_id uuid, p_code_hash text, p_challenge text)
returns boolean language sql security invoker set search_path = '' as $$
  select office_private.marketplace_issue_code(p_source_id, p_office_user_id, p_code_hash, p_challenge)
$$;
create function public.office_marketplace_consume_code(p_code_hash text, p_challenge text)
returns jsonb language sql security invoker set search_path = '' as $$
  select office_private.marketplace_consume_code(p_code_hash, p_challenge)
$$;
revoke all on function public.office_marketplace_lookup(uuid, text) from public, anon, authenticated;
revoke all on function public.office_marketplace_link(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.office_marketplace_issue_code(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.office_marketplace_consume_code(text, text) from public, anon, authenticated;
grant execute on function public.office_marketplace_lookup(uuid, text) to service_role;
grant execute on function public.office_marketplace_link(uuid, uuid, text, text) to service_role;
grant execute on function public.office_marketplace_issue_code(uuid, uuid, text, text) to service_role;
grant execute on function public.office_marketplace_consume_code(text, text) to service_role;
comment on table office_private.marketplace_identities is 'Fixed one-to-one verified marketplace-to-Office user mapping; clients cannot inspect or alter links.';
comment on table office_private.marketplace_login_codes is 'SHA-256-only, 120-second, single-use S256-PKCE login handoffs. Ten requests per source identity per five minutes.';
notify pgrst, 'reload schema';
