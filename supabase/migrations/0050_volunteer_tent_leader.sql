-- Tent leader manages volunteer needs too (regatta-day tent + volunteer
-- coordination is the same job), not just admins/coaches — same pattern
-- food_tent_items already uses.
drop policy if exists "coaches and admins manage volunteer needs" on volunteer_needs;

create policy "admins, coaches, and tent leaders manage volunteer needs"
  on volunteer_needs for all
  to authenticated
  using (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ))
  with check (exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'coach') or p.is_tent_leader)
  ));
