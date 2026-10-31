-- Only bootstrap a caller's first office; no client-supplied owner/user/tenant/role.
create function office_private.create_first_office(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_office uuid;
begin
 if v_user is null or not exists (
 select 1 from auth.users u where u.id=v_user and u.is_anonymous is not true
 and u.email_confirmed_at is not null and u.deleted_at is null
 and (u.banned_until is null or u.banned_until < now())
 ) then raise exception 'Verified permanent account required' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 200 then
 raise exception 'Office name must contain 1 to 200 characters' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(16092026,hashtext(v_user::text));
 select m.office_id into v_office from public.office_members m
 where m.user_id=v_user and m.role='owner' and m.status='active'
 order by m.created_at,m.id limit 1;
 if v_office is not null then return v_office; end if;
 if exists (select 1 from public.office_members where user_id=v_user) then
 raise exception 'Existing members cannot create another office' using errcode='42501'; end if;
 insert into public.offices(name) values (btrim(p_name)) returning id into v_office;
 insert into public.office_members(office_id,user_id,role,status) values(v_office,v_user,'owner','active');
 return v_office;
end $$;
revoke all on function office_private.create_first_office(text) from public,anon,authenticated;
grant usage on schema office_private to authenticated;
grant execute on function office_private.create_first_office(text) to authenticated;
create function public.office_create(p_name text) returns uuid
language sql security invoker set search_path='' as $$
 select office_private.create_first_office(p_name);
$$;
revoke all on function public.office_create(text) from public,anon,authenticated;
grant execute on function public.office_create(text) to authenticated;
comment on function public.office_create(text) is 'Creates the verified caller first office and owner membership atomically. Repeat requests return existing active owned office. No arbitrary membership operations.';

