-- Rowers and coxswains move to Alumni once they graduate: on July 1 of
-- their grad year (after the spring season and youth nationals), they leave
-- the Men's, Women's and Development teams (and those team chats) and join
-- Alumni (and its chat), through the usual team-chat triggers.
--
-- Only people not already in Alumni are moved, so a coach can put an alum
-- back on a team by hand and they'll stay. Runs every morning.

create or replace function public.graduate_to_alumni()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moved integer;
begin
  create temporary table graduates on commit drop as
  select p.id, p.club_id
  from profiles p
  where p.role in ('rower', 'coxswain')
    and p.grad_year is not null
    and p.disabled_at is null
    and make_date(p.grad_year, 7, 1) <= current_date
    and exists (
      select 1 from profile_teams t
      where t.profile_id = p.id and t.team in ('mens', 'womens', 'development')
    )
    and not exists (
      select 1 from profile_teams t
      where t.profile_id = p.id and t.team = 'alumni'
    );

  delete from profile_teams t
  using graduates g
  where t.profile_id = g.id and t.team in ('mens', 'womens', 'development');

  insert into profile_teams (profile_id, team, club_id)
  select id, 'alumni', club_id from graduates
  on conflict do nothing;

  select count(*) into moved from graduates;
  drop table graduates;
  return moved;
end;
$$;

revoke execute on function public.graduate_to_alumni() from public, anon, authenticated;

select cron.unschedule('graduate-to-alumni') where exists (select 1 from cron.job where jobname = 'graduate-to-alumni');
select cron.schedule('graduate-to-alumni', '10 10 * * *', $$select public.graduate_to_alumni();$$);
