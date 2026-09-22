-- Automatically kicks off regatta prep 7 days out, with no one needing to
-- have the app open: a daily pg_cron job (Postgres-side, runs inside the
-- hosted Supabase project) finds regattas exactly 7 days away, copies the
-- most recent past regatta's food list in as an unpublished draft, and
-- marks it pending_confirmation so the tent-leader home banner picks it up.
--
-- NOTE: if this migration fails on `create extension pg_cron`, enable the
-- "pg_cron" extension first via the Supabase dashboard (Database ->
-- Extensions), then re-run this file.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function generate_regatta_prep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  regatta record;
  prior_event_id uuid;
begin
  for regatta in
    select e.id, e.starts_at
    from schedule_events e
    where e.event_type = 'regatta'
      and e.starts_at::date = (now()::date + interval '7 days')::date
      -- Idempotent (safe if the daily job runs more than once) and never
      -- overwrites a food list someone already started building by hand.
      and not exists (select 1 from food_tent_status s where s.event_id = e.id)
      and not exists (select 1 from food_tent_items fi where fi.event_id = e.id)
  loop
    insert into food_tent_status (event_id, status, draft_generated_at)
    values (regatta.id, 'pending_confirmation', now());

    select fi.event_id into prior_event_id
    from food_tent_items fi
    join schedule_events pe on pe.id = fi.event_id
    where pe.event_type = 'regatta'
      and pe.starts_at < regatta.starts_at
    order by pe.starts_at desc
    limit 1;

    if prior_event_id is not null then
      insert into food_tent_items (event_id, title, quantity_needed, notes, published)
      select regatta.id, title, quantity_needed, notes, false
      from food_tent_items
      where event_id = prior_event_id;
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'regatta-food-prep-daily',
  '0 12 * * *',
  $$select generate_regatta_prep();$$
);
