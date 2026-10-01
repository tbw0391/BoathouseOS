-- Forms, surveys and elections (/forms), building on polls.
--
-- - forms: a form/survey (kind 'form') or a board election (kind 'election'),
--   shown to an audience (everyone, rowers, parents, coaches, board), with
--   an optional closing time. Admins, coaches and board members make forms;
--   admins and board members make elections.
-- - form_questions: a form's questions (short or long text, one choice,
--   checkboxes, yes/no, date, number, file upload). For an election each
--   question is an office, its options are the candidates and max_picks is
--   how many seats.
-- - form_responses: one per person per form; answers is JSON keyed by
--   question id. Editable until the form closes. The person and the form's
--   managers (its creator, admins, board members) can read it.
-- - Elections are secret: election_voters records who voted (for turnout
--   and one vote each), election_ballots holds the picks with no voter and
--   no time on them. Both are only written by cast_ballot(), and ballots
--   can only be read once the election is closed.
-- - Who can vote: everyone in the audience, adults only (rowers and coxes
--   need a birthday 18+ years ago), or one vote per family (spouses, and
--   guardians of the same rowers, plus those rowers, share one vote).
-- - A private "form-files" bucket for file answers, in a folder per club.
--   Only the service role reads and writes it (server actions check
--   access and hand out signed links).
--
-- Safe to re-run.

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  kind text not null default 'form' check (kind in ('form', 'election')),
  title text not null check (length(trim(title)) > 0),
  description text,
  audience text not null default 'everyone'
    check (audience in ('everyone', 'rowers', 'parents', 'coaches', 'board')),
  voters text not null default 'everyone' check (voters in ('everyone', 'adults', 'family')),
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists forms_club_id_idx on public.forms (club_id);
create index if not exists forms_created_by_idx on public.forms (created_by);

create table if not exists public.form_questions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  form_id uuid not null references public.forms (id) on delete cascade,
  position integer not null default 0,
  kind text not null
    check (kind in ('short', 'long', 'choice', 'checkboxes', 'yes_no', 'date', 'number', 'file')),
  label text not null check (length(trim(label)) > 0),
  help text,
  required boolean not null default false,
  options text[] not null default '{}',
  max_picks integer not null default 1 check (max_picks >= 1)
);

create index if not exists form_questions_club_id_idx on public.form_questions (club_id);
create index if not exists form_questions_form_id_idx on public.form_questions (form_id);

create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  form_id uuid not null references public.forms (id) on delete cascade,
  respondent_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, respondent_id)
);

create index if not exists form_responses_club_id_idx on public.form_responses (club_id);
create index if not exists form_responses_respondent_id_idx on public.form_responses (respondent_id);

create table if not exists public.election_voters (
  form_id uuid not null references public.forms (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  voted_at timestamptz not null default now(),
  primary key (form_id, voter_id)
);

create index if not exists election_voters_club_id_idx on public.election_voters (club_id);
create index if not exists election_voters_voter_id_idx on public.election_voters (voter_id);

create table if not exists public.election_ballots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  form_id uuid not null references public.forms (id) on delete cascade,
  question_id uuid not null references public.form_questions (id) on delete cascade,
  choice text not null
);

create index if not exists election_ballots_club_id_idx on public.election_ballots (club_id);
create index if not exists election_ballots_form_id_idx on public.election_ballots (form_id);
create index if not exists election_ballots_question_id_idx on public.election_ballots (question_id);

-- Open: not closed by hand and not past its closing time.
create or replace function public.form_is_open(p_form uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select f.closed_at is null and (f.closes_at is null or f.closes_at > now())
    from forms f where f.id = p_form
  ), false);
$$;

-- Its creator, admins and board members of its club.
create or replace function public.can_manage_form(p_form uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved() and exists (
    select 1 from forms f join profiles me on me.id = auth.uid() and me.club_id = f.club_id
    where f.id = p_form
      and (f.created_by = me.id or me.role = 'admin' or me.is_board_member)
  );
$$;

create or replace function public.can_see_form(p_form uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_form(p_form) or (public.is_approved() and exists (
    select 1 from forms f join profiles me on me.id = auth.uid() and me.club_id = f.club_id
    where f.id = p_form
      and case f.audience
        when 'everyone' then true
        when 'rowers' then me.role in ('rower', 'coxswain')
        when 'parents' then me.role = 'parent'
          or exists (select 1 from family_links fl where fl.guardian_id = me.id)
        when 'coaches' then me.role in ('coach', 'admin')
        when 'board' then me.is_board_member or me.role = 'admin'
        else false
      end
  ));
$$;

-- A member's household for "one vote per family": them and their spouse,
-- the rowers either of them is a guardian of (or themselves, if they're
-- such a rower), and every guardian of those rowers and their spouses.
create or replace function public.household_ids(person uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select person as id
    union select spouse_id from profiles where id = person and spouse_id is not null
    union select id from profiles where spouse_id = person
  ),
  kids as (
    select rower_id as id from family_links where guardian_id in (select id from base)
    union select person from family_links where rower_id = person
  ),
  adults as (
    select id from base
    union select guardian_id from family_links where rower_id in (select id from kids)
  ),
  everyone as (
    select id from adults
    union select spouse_id from profiles where id in (select id from adults) and spouse_id is not null
    union select id from profiles where spouse_id in (select id from adults)
    union select id from kids
  )
  select id from everyone;
$$;

-- Why the signed-in member can't vote in this election, or null if they can.
create or replace function public.ballot_blocker(p_form uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f forms;
  me profiles;
begin
  select * into f from forms where id = p_form;
  select * into me from profiles where id = auth.uid();
  if f.id is null or me.id is null or f.club_id <> me.club_id or f.kind <> 'election'
     or not public.can_see_form(p_form) then
    return 'This election isn''t open to you.';
  end if;
  if not public.form_is_open(p_form) then
    return 'Voting has closed.';
  end if;
  if exists (select 1 from election_voters where form_id = p_form and voter_id = me.id) then
    return 'You''ve already voted.';
  end if;
  if f.voters = 'adults' and me.role in ('rower', 'coxswain')
     and (me.birthday is null or me.birthday > (current_date - interval '18 years')::date) then
    return 'Only members 18 and over can vote in this election.';
  end if;
  if f.voters = 'family' and exists (
    select 1 from election_voters v
    where v.form_id = p_form and v.voter_id in (select public.household_ids(me.id))
  ) then
    return 'Someone in your family has already voted (one vote per family).';
  end if;
  return null;
end;
$$;

-- Records a secret ballot. p_picks is {question_id: ["candidate", ...]}.
-- An office can be left blank; each pick must be one of its candidates, at
-- most max_picks of them.
create or replace function public.cast_ballot(p_form uuid, p_picks jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  blocker text;
  q form_questions;
  picks text[];
  club uuid;
begin
  blocker := public.ballot_blocker(p_form);
  if blocker is not null then
    raise exception '%', blocker using errcode = 'P0001';
  end if;
  select club_id into club from forms where id = p_form;

  -- Stops two people in one family voting at the same moment.
  perform pg_advisory_xact_lock(hashtext('ballot:' || p_form::text));
  blocker := public.ballot_blocker(p_form);
  if blocker is not null then
    raise exception '%', blocker using errcode = 'P0001';
  end if;

  for q in select * from form_questions where form_id = p_form loop
    select coalesce(array_agg(distinct v), '{}') into picks
    from jsonb_array_elements_text(coalesce(p_picks -> q.id::text, '[]'::jsonb)) v;
    if cardinality(picks) > q.max_picks then
      raise exception 'Pick at most % for %.', q.max_picks, q.label using errcode = 'P0001';
    end if;
    if q.required and cardinality(picks) = 0 then
      raise exception 'Make a pick for %.', q.label using errcode = 'P0001';
    end if;
    if not picks <@ q.options then
      raise exception 'That isn''t a candidate for %.', q.label using errcode = 'P0001';
    end if;
    insert into election_ballots (club_id, form_id, question_id, choice)
    select club, p_form, q.id, unnest(picks);
  end loop;

  insert into election_voters (form_id, voter_id, club_id) values (p_form, auth.uid(), club);
end;
$$;

revoke execute on function public.form_is_open(uuid) from public, anon;
revoke execute on function public.can_manage_form(uuid) from public, anon;
revoke execute on function public.can_see_form(uuid) from public, anon;
revoke execute on function public.household_ids(uuid) from public, anon, authenticated;
revoke execute on function public.ballot_blocker(uuid) from public, anon;
revoke execute on function public.cast_ballot(uuid, jsonb) from public, anon;
grant execute on function public.form_is_open(uuid) to authenticated;
grant execute on function public.can_manage_form(uuid) to authenticated;
grant execute on function public.can_see_form(uuid) to authenticated;
grant execute on function public.ballot_blocker(uuid) to authenticated;
grant execute on function public.cast_ballot(uuid, jsonb) to authenticated;

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_responses enable row level security;
alter table public.election_voters enable row level security;
alter table public.election_ballots enable row level security;

drop policy if exists "audience reads forms" on public.forms;
create policy "audience reads forms"
  on public.forms for select to authenticated using (public.can_see_form(id));

drop policy if exists "organizers create forms" on public.forms;
create policy "organizers create forms"
  on public.forms for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and (me.role = 'admin' or me.is_board_member or (kind = 'form' and me.role = 'coach'))
    )
  );

drop policy if exists "managers change forms" on public.forms;
create policy "managers change forms"
  on public.forms for update to authenticated
  using (public.can_manage_form(id)) with check (public.can_manage_form(id));

drop policy if exists "managers delete forms" on public.forms;
create policy "managers delete forms"
  on public.forms for delete to authenticated using (public.can_manage_form(id));

drop policy if exists "audience reads questions" on public.form_questions;
create policy "audience reads questions"
  on public.form_questions for select to authenticated using (public.can_see_form(form_id));

drop policy if exists "managers change questions" on public.form_questions;
create policy "managers change questions"
  on public.form_questions for all to authenticated
  using (public.can_manage_form(form_id)) with check (public.can_manage_form(form_id));

drop policy if exists "own or managed responses" on public.form_responses;
create policy "own or managed responses"
  on public.form_responses for select to authenticated
  using (respondent_id = (select auth.uid()) or public.can_manage_form(form_id));

drop policy if exists "answer open forms" on public.form_responses;
create policy "answer open forms"
  on public.form_responses for insert to authenticated
  with check (
    respondent_id = (select auth.uid())
    and public.can_see_form(form_id)
    and public.form_is_open(form_id)
    and exists (select 1 from public.forms f where f.id = form_id and f.kind = 'form')
  );

drop policy if exists "change own answers while open" on public.form_responses;
create policy "change own answers while open"
  on public.form_responses for update to authenticated
  using (respondent_id = (select auth.uid()) and public.form_is_open(form_id))
  with check (respondent_id = (select auth.uid()) and public.form_is_open(form_id));

drop policy if exists "delete own or managed responses" on public.form_responses;
create policy "delete own or managed responses"
  on public.form_responses for delete to authenticated
  using (respondent_id = (select auth.uid()) or public.can_manage_form(form_id));

-- Written only by cast_ballot().
drop policy if exists "own vote or managers" on public.election_voters;
create policy "own vote or managers"
  on public.election_voters for select to authenticated
  using (voter_id = (select auth.uid()) or public.can_manage_form(form_id));

drop policy if exists "results once closed" on public.election_ballots;
create policy "results once closed"
  on public.election_ballots for select to authenticated
  using (public.can_see_form(form_id) and not public.form_is_open(form_id));

select public.apply_approval_gate();
select public.apply_club_isolation();

insert into storage.buckets (id, name, public, file_size_limit)
values ('form-files', 'form-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
