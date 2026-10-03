alter policy office_members_read_self on public.office_members using (user_id=(select auth.uid()) and status='active' and coalesce(((select auth.jwt())->>'is_anonymous'),'false') <> 'true');
