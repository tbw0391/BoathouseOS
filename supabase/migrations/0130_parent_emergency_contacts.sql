-- Fill a rower's emergency contacts (0088) from their parents' cell phones.
-- When a parent is linked to a rower (family_links), or a linked parent adds
-- or changes the phone on their profile, the parent goes into the first
-- empty contact slot as "Parent". Never overwrites a contact someone typed
-- in; if both slots are taken the rower's contacts are left alone. A parent
-- who changes their number has it updated in the slot that had the old one.
-- Also fills in every rower already linked to a parent. Safe to re-run.

create or replace function public.phone_digits(p text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '');
$$;

create or replace function public.fill_parent_emergency_contact(
  p_rower uuid,
  p_guardian uuid,
  p_old_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  e emergency_info%rowtype;
  new_digits text;
  old_digits text := public.phone_digits(p_old_phone);
begin
  select coalesce(nullif(trim(display_name), ''), trim(concat_ws(' ', first_name, last_name))) as name,
         trim(phone) as phone
    into g
    from profiles where id = p_guardian;
  new_digits := public.phone_digits(g.phone);
  if new_digits is null then
    return;
  end if;

  insert into emergency_info (profile_id, club_id)
  select id, club_id from profiles where id = p_rower
  on conflict (profile_id) do nothing;

  select * into e from emergency_info where profile_id = p_rower for update;
  if not found then
    return;
  end if;

  -- Already listed.
  if new_digits in (coalesce(public.phone_digits(e.contact1_phone), ''), coalesce(public.phone_digits(e.contact2_phone), '')) then
    return;
  end if;

  if old_digits is not null and public.phone_digits(e.contact1_phone) = old_digits then
    update emergency_info set contact1_phone = g.phone, updated_at = now() where profile_id = p_rower;
  elsif old_digits is not null and public.phone_digits(e.contact2_phone) = old_digits then
    update emergency_info set contact2_phone = g.phone, updated_at = now() where profile_id = p_rower;
  elsif public.phone_digits(e.contact1_phone) is null then
    update emergency_info
      set contact1_name = coalesce(nullif(trim(contact1_name), ''), g.name),
          contact1_relation = coalesce(nullif(trim(contact1_relation), ''), 'Parent'),
          contact1_phone = g.phone,
          updated_at = now()
      where profile_id = p_rower;
  elsif public.phone_digits(e.contact2_phone) is null then
    update emergency_info
      set contact2_name = coalesce(nullif(trim(contact2_name), ''), g.name),
          contact2_relation = coalesce(nullif(trim(contact2_relation), ''), 'Parent'),
          contact2_phone = g.phone,
          updated_at = now()
      where profile_id = p_rower;
  end if;
end;
$$;

revoke execute on function public.fill_parent_emergency_contact(uuid, uuid, text) from public, anon, authenticated;

-- A parent is linked to a rower.
create or replace function public.family_link_emergency_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fill_parent_emergency_contact(new.rower_id, new.guardian_id);
  return null;
end;
$$;

revoke execute on function public.family_link_emergency_contact() from public, anon, authenticated;

drop trigger if exists family_link_emergency_contact on public.family_links;
create trigger family_link_emergency_contact
  after insert on public.family_links
  for each row execute function public.family_link_emergency_contact();

-- A linked parent adds or changes their phone.
create or replace function public.parent_phone_emergency_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r uuid;
begin
  for r in select rower_id from family_links where guardian_id = new.id order by created_at loop
    perform public.fill_parent_emergency_contact(r, new.id, old.phone);
  end loop;
  return null;
end;
$$;

revoke execute on function public.parent_phone_emergency_contact() from public, anon, authenticated;

drop trigger if exists parent_phone_emergency_contact on public.profiles;
create trigger parent_phone_emergency_contact
  after update of phone on public.profiles
  for each row
  when (public.phone_digits(new.phone) is distinct from public.phone_digits(old.phone))
  execute function public.parent_phone_emergency_contact();

-- Rowers already linked to a parent.
do $$
declare
  f record;
begin
  for f in select rower_id, guardian_id from family_links order by created_at loop
    perform public.fill_parent_emergency_contact(f.rower_id, f.guardian_id);
  end loop;
end;
$$;
