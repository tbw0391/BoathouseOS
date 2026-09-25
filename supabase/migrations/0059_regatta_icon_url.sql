-- Lets "Add regatta from a link" (see lib/urlMeta.ts / lib/crewtimer.ts) store
-- a regatta-specific icon it found automatically — either a CrewTimer
-- regatta's own LogoURL, or a favicon/apple-touch-icon scraped from
-- whatever page the coach pasted — instead of only the hand-maintained
-- keyword lookup in lib/eventIcons.ts.

alter table schedule_events add column if not exists icon_url text;
