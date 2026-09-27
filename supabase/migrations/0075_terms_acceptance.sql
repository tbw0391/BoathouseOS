-- When each member agreed to the Terms and Privacy Policy, and which version
-- (lib/terms.ts TERMS_VERSION). Set at signup; null for members added by an
-- admin or who joined before the Terms existed.

alter table profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;
