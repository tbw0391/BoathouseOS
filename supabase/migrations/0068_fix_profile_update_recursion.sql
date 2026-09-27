-- "coaches and admins update any profile" (0002) looked the caller up in
-- profiles from inside a profiles policy. Postgres rejects that as
-- "infinite recursion detected in policy for relation profiles", which
-- failed EVERY profile update for everyone (editing a bio, admin toggles
-- like board member / tent leader / treasurer). Same check, done in a
-- security-definer helper like is_approved() / is_club_admin().

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('coach', 'admin') and approved_at is not null and disabled_at is null
  ) or public.is_global_admin();
$$;

drop policy if exists "coaches and admins update any profile" on profiles;
create policy "coaches and admins update any profile"
  on profiles for update
  to authenticated
  using ((select public.is_coach_or_admin()))
  with check ((select public.is_coach_or_admin()));
