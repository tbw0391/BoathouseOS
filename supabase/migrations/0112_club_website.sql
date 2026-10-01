-- Public club website (/site on the club's address). Most of it is built from
-- the club's own data (regattas, results, coaches); these hold what admins
-- write and what visitors send. Settings (on/off, tagline, about, sections)
-- are in club_settings "website". The site itself reads with the service
-- role, scoped to the address's club, and only shows public-safe fields.
--
-- - website_pages: pages (history, Learn to Row...) and news posts.
-- - website_inquiries: the site's contact and join forms (written with the
--   service role; admins read them in the app).
--
-- Safe to re-run.

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  kind text not null default 'page' check (kind in ('page', 'news')),
  slug text not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, slug)
);

create table if not exists public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.default_club_id() references public.clubs (id),
  kind text not null default 'contact' check (kind in ('contact', 'join')),
  name text,
  email text,
  phone text,
  message text,
  ip text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists website_pages_club_id_idx on public.website_pages (club_id);
create index if not exists website_inquiries_club_id_idx on public.website_inquiries (club_id, created_at desc);

alter table public.website_pages enable row level security;
alter table public.website_inquiries enable row level security;

drop policy if exists "admins manage website pages" on public.website_pages;
create policy "admins manage website pages"
  on public.website_pages for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

drop policy if exists "admins manage website inquiries" on public.website_inquiries;
create policy "admins manage website inquiries"
  on public.website_inquiries for all to authenticated
  using ((select public.is_club_admin())) with check ((select public.is_club_admin()));

drop policy if exists "approved members only" on public.website_pages;
create policy "approved members only" on public.website_pages as restrictive for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));
drop policy if exists "approved members only" on public.website_inquiries;
create policy "approved members only" on public.website_inquiries as restrictive for all to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));

select public.apply_club_isolation();
