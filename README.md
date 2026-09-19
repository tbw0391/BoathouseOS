# W-Crew-app

PWA for Westerville Rowing Club: roster, schedule, lineups, volunteer needs,
team store link, and messaging.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, RLS)
- PWA via `@ducanh2912/next-pwa`

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase project URL + anon key
npm run dev
```

## Database

Schema lives in `supabase/migrations/`. Apply with the Supabase CLI or paste
into the SQL editor of your Supabase project:

```bash
supabase db push
```

## PWA

The manifest is at `public/manifest.json`, icons in `public/icons/`
(placeholders — swap for real club branding). The service worker is
generated at build time and disabled in development.
