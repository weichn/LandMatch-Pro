-- Target only: marketplace avenejzzakocgmoszlto.
-- Self-only attestation. Account kind never grants an approved marketplace role.
create or replace function private.office_identity()
returns table(user_id uuid, email text, name text, office_name text, role text, account_kind text)
language sql stable security definer set search_path = '' as $$
  select p.id, u.email, p.name,
    left(coalesce(nullif(btrim(a.firm_name), ''), nullif(btrim(ap.office_name), ''),
      nullif(btrim(u.raw_user_meta_data->>'office_name'), ''),
      nullif(btrim(p.name), '') || '的事務所', '我的事務所'), 200),
    p.role, p.account_kind
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.agents a on a.profile_id = p.id
  left join public.agent_applications ap on ap.user_id = p.id
  where p.id = (select auth.uid())
    and u.is_anonymous is not true and u.email is not null
    and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now())
    -- Logged-out/revoked sessions cannot mint a fresh cross-application login.
    and exists(select 1 from auth.sessions s
      where s.user_id = p.id and s.id::text = (select auth.jwt())->>'session_id'
        and (s.not_after is null or s.not_after > now()))
    and ((p.account_kind = 'agent' and p.role in ('client', 'agent'))
      or (p.account_kind = 'admin' and p.role = 'admin'))
$$;
revoke all on function private.office_identity() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.office_identity() to authenticated;

create or replace function public.get_office_identity()
returns table(user_id uuid, email text, name text, office_name text, role text, account_kind text)
language sql stable security invoker set search_path = '' as $$
  select * from private.office_identity()
$$;
revoke all on function public.get_office_identity() from public, anon, authenticated, service_role;
grant execute on function public.get_office_identity() to authenticated;
comment on function public.get_office_identity() is 'Self-only Office eligibility for a verified, active, permanent professional applicant, approved agent, or administrator. Editable metadata is used only as a display-label fallback.';
notify pgrst, 'reload schema';
