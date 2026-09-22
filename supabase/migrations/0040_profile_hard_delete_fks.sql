-- Prepares for a real hard-delete of a profiles row (see app/roster/[id]/actions.ts
-- permanentlyDeleteProfile). Every FK below currently has no ON DELETE rule
-- (Postgres default: NO ACTION), which would just block the delete outright.
--
-- Split in two:
--  - SET NULL for "shared container" columns other people's own data hangs
--    off of (an event's RSVPs, a boat's other seats, a poll's other votes,
--    a chat's other participants, etc.) — the record survives, it just no
--    longer says who made it, same as suggestions.submitted_by /
--    maintenance_requests.submitted_by already work today.
--  - CASCADE for genuinely personal, singular content (their own messages,
--    photos they uploaded, a tag they made) that doesn't have other
--    people's independent records nested inside it.
--
-- Looks up each existing constraint by table+column rather than assuming a
-- name, since these were all created inline (no explicit CONSTRAINT name)
-- and Postgres's default naming isn't worth gambling on for something this
-- destructive.
do $$
declare
  r record;
  existing_fk text;
begin
  for r in
    select * from (values
      ('schedule_events', 'created_by', 'set null'),
      ('lineups', 'created_by', 'set null'),
      ('lineup_seats', 'rower_id', 'set null'),
      ('volunteer_needs', 'created_by', 'set null'),
      ('chat_groups', 'created_by', 'set null'),
      ('food_tent_items', 'created_by', 'set null'),
      ('boats', 'created_by', 'set null'),
      ('polls', 'created_by', 'set null'),
      ('races', 'created_by', 'set null'),
      ('lineup_templates', 'created_by', 'set null'),
      ('lineup_template_seats', 'rower_id', 'set null'),
      ('profiles', 'spouse_id', 'set null'),
      ('messages', 'sender_id', 'cascade'),
      ('photos', 'uploaded_by', 'cascade'),
      ('photo_tags', 'tagged_by', 'cascade')
    ) as t(table_name, column_name, rule)
  loop
    select con.conname into existing_fk
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and con.conrelid = r.table_name::regclass
      and con.confrelid = 'profiles'::regclass
      and att.attname = r.column_name
    limit 1;

    if existing_fk is not null then
      execute format('alter table %I drop constraint %I', r.table_name, existing_fk);
    end if;

    execute format(
      'alter table %I add constraint %I foreign key (%I) references profiles (id) on delete %s',
      r.table_name,
      r.table_name || '_' || r.column_name || '_fkey',
      r.column_name,
      r.rule
    );
  end loop;
end $$;
