-- On the Water: the coxswain picks which boat their phone is in when they
-- start an outing, and each outing gets its own map color so coaches can tell
-- boats apart. Tracking is for coxswains only for now (it used to also allow
-- anyone sitting in a lineup's cox seat).

alter table on_water_sessions
  add column boat_id uuid references boats (id) on delete set null,
  add column color text;

-- Picks a color no other boat on the water is using, keeping the coxswain's
-- color from their last outing when it's free. Security definer because a
-- coxswain can't read other coxswains' sessions.
create or replace function public.pick_on_water_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array[
    '#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4', '#42d4f4',
    '#f032e6', '#9a6324', '#469990', '#000075', '#808000', '#800000'
  ];
  in_use text[];
  previous text;
  c text;
begin
  if new.color is not null then
    return new;
  end if;

  select coalesce(array_agg(color), '{}') into in_use
  from on_water_sessions
  where ended_at is null and color is not null;

  select color into previous
  from on_water_sessions
  where coxswain_id = new.coxswain_id and color is not null
  order by started_at desc
  limit 1;

  if previous is not null and not previous = any (in_use) then
    new.color := previous;
    return new;
  end if;

  foreach c in array palette loop
    if not c = any (in_use) then
      new.color := c;
      return new;
    end if;
  end loop;

  new.color := palette[1 + (cardinality(in_use) % cardinality(palette))];
  return new;
end;
$$;

create trigger on_water_sessions_pick_color
  before insert on on_water_sessions
  for each row execute function public.pick_on_water_color();

drop policy "eligible coxswains start their own session" on on_water_sessions;

create policy "coxswains start their own session"
  on on_water_sessions for insert
  to authenticated
  with check (
    auth.uid() = coxswain_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'coxswain')
  );
