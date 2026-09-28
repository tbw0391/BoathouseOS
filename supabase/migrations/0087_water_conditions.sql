-- Practice go/no-go (/water). The gauge and limits live in club_settings
-- ("water_conditions", admins). Coaches make the day's call and start or
-- clear lightning holds; everyone in the club can see both. Safe to re-run.

create table if not exists practice_calls (
  practice_date date primary key,
  status text not null check (status in ('go', 'caution', 'land', 'cancelled')),
  note text,
  water_temp_f numeric(4, 1),
  called_by uuid references profiles (id) on delete set null,
  called_at timestamptz not null default now()
);

create table if not exists lightning_holds (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  last_strike_at timestamptz not null default now(),
  cleared_at timestamptz,
  started_by uuid references profiles (id) on delete set null,
  cleared_by uuid references profiles (id) on delete set null
);

create index if not exists lightning_holds_open_idx on lightning_holds (started_at desc) where cleared_at is null;

alter table practice_calls enable row level security;
alter table lightning_holds enable row level security;

do $$
declare t text;
begin
  foreach t in array array['practice_calls', 'lightning_holds']
  loop
    execute format('drop policy if exists "members see water calls" on %I', t);
    execute format('create policy "members see water calls" on %I for select to authenticated using (true)', t);
    execute format('drop policy if exists "coaches and admins make water calls" on %I', t);
    execute format(
      'create policy "coaches and admins make water calls" on %I for all to authenticated '
      || 'using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin''))) '
      || 'with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in (''coach'', ''admin'')))',
      t
    );
  end loop;
end $$;

select public.apply_approval_gate();
