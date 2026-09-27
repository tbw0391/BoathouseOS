-- The coxswain now picks their boat's map color from 10 swatches (see
-- lib/onWaterColors.ts, which must list the same colors). The trigger from
-- 0070 still fills one in if none was sent.

create or replace function public.pick_on_water_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array[
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#db2777', '#0d9488', '#ca8a04', '#92400e', '#111827'
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

  if previous is not null and previous = any (palette) and not previous = any (in_use) then
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

update on_water_sessions set color = null
where color is not null and color not in (
  '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
  '#db2777', '#0d9488', '#ca8a04', '#92400e', '#111827'
);

alter table on_water_sessions
  add constraint on_water_sessions_color_check check (color in (
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#db2777', '#0d9488', '#ca8a04', '#92400e', '#111827'
  ));

-- Colors other boats on the water are using right now, so the picker can grey
-- them out. A coxswain can't read other coxswains' sessions directly.
create or replace function public.on_water_colors_in_use()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(color), '{}')
  from on_water_sessions
  where ended_at is null and color is not null and coxswain_id <> auth.uid();
$$;

revoke execute on function public.on_water_colors_in_use() from public, anon;
grant execute on function public.on_water_colors_in_use() to authenticated;
