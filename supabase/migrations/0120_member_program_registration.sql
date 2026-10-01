-- Members register for programs from the app (/programs), using what the app
-- already knows about the rower (0117 was website-only):
-- - program_registrations.profile_id: the member registered (a rower, or an
--   adult registering themselves); null for a website registration.
--   registered_by: who did it. A member can only be signed up once per
--   program (cancelled ones don't count).
-- - The member, their parents/guardians, coaches and admins can read a
--   member's registrations (can_act_for, 0086), for the app's Programs page
--   and the rower's profile. Writes still go through the service role.
--
-- Safe to re-run.

alter table public.program_registrations
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists registered_by uuid references public.profiles (id) on delete set null;

create index if not exists program_registrations_profile_id_idx on public.program_registrations (profile_id);
create index if not exists program_registrations_registered_by_idx on public.program_registrations (registered_by);
create unique index if not exists program_registrations_one_per_member
  on public.program_registrations (program_id, profile_id)
  where profile_id is not null and status <> 'cancelled';

drop policy if exists "families read their own registrations" on public.program_registrations;
create policy "families read their own registrations"
  on public.program_registrations for select to authenticated
  using (profile_id is not null and public.can_act_for(profile_id));

select public.apply_club_isolation();
