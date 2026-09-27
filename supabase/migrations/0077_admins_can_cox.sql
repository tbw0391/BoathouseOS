-- Admins can also cox: they can start GPS tracking for their own boat, same
-- as a coxswain (they already see every boat on the map).

drop policy if exists "coxswains start their own session" on on_water_sessions;

create policy "coxswains start their own session"
  on on_water_sessions for insert
  to authenticated
  with check (
    auth.uid() = coxswain_id
    and exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('coxswain', 'admin')
    )
  );
