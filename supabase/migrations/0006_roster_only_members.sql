-- Allow a profile to exist without a matching auth.users login, so admins
-- can add someone straight to the roster without sending an invite. The id
-- still defaults to a fresh uuid; if the person later signs up themselves,
-- an admin can re-point their auth account's id to this row (manual step).

alter table profiles
  alter column id set default gen_random_uuid();

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'profiles'::regclass
    and contype = 'f'
    and confrelid = 'auth.users'::regclass;

  if fk_name is not null then
    execute format('alter table profiles drop constraint %I', fk_name);
  end if;
end $$;
