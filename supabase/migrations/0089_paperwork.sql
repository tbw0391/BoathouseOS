-- Paperwork per member (USRowing membership, waiver, swim test, SafeSport,
-- background check): when it was done and when it runs out. The member,
-- their guardians, coaches and admins can see and update it; a coach or
-- admin saving it marks it checked. Safe to re-run.

create table if not exists member_paperwork (
  profile_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('usrowing', 'waiver', 'swim_test', 'safesport', 'background_check')),
  completed_on date,
  expires_on date,
  checked_by uuid references profiles (id) on delete set null,
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, kind)
);

alter table member_paperwork enable row level security;

drop policy if exists "self, guardians, coaches and admins see paperwork" on member_paperwork;
create policy "self, guardians, coaches and admins see paperwork"
  on member_paperwork for select
  to authenticated
  using (public.can_act_for(profile_id));

drop policy if exists "self, guardians, coaches and admins manage paperwork" on member_paperwork;
create policy "self, guardians, coaches and admins manage paperwork"
  on member_paperwork for all
  to authenticated
  using (public.can_act_for(profile_id))
  with check (public.can_act_for(profile_id));

-- Only a coach or admin's save counts as checked.
create or replace function public.paperwork_checked_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and role in ('coach', 'admin')) then
    new.checked_by := auth.uid();
  elsif auth.uid() is not null then
    new.checked_by := null;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.paperwork_checked_by() from public, anon, authenticated;

drop trigger if exists paperwork_checked_by on member_paperwork;
create trigger paperwork_checked_by
  before insert or update on member_paperwork
  for each row execute function public.paperwork_checked_by();

select public.apply_approval_gate();
