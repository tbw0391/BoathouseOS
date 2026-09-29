-- Text message (SMS) alerts through Twilio, for the urgent kinds only
-- (lightning hold, today's practice call, launch times). Opt-in: a member
-- enters their mobile number and ticks the consent box on their profile;
-- the exact wording they agreed to and when are kept, as carriers require.
-- Replying STOP (Twilio's inbound webhook) or turning it off marks
-- opted_out_at; texts only go to rows with consent and no opt-out.
-- Rowers and coxswains under 18 can't opt in; their parents get the texts
-- (Safe Sport). Safe to re-run.

create table if not exists sms_consents (
  profile_id uuid primary key references profiles (id) on delete cascade,
  -- E.164, e.g. +16145551234.
  phone text not null check (phone ~ '^\+1[2-9][0-9]{9}$'),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  opted_out_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists sms_consents_phone_idx on sms_consents (phone);

alter table sms_consents enable row level security;

-- Each member sees and manages only their own; sending uses the service role.
drop policy if exists "members see their own text consent" on sms_consents;
create policy "members see their own text consent"
  on sms_consents for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "members manage their own text consent" on sms_consents;
create policy "members manage their own text consent"
  on sms_consents for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

select public.apply_approval_gate();
