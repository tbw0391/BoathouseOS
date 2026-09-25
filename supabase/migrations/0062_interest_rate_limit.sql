-- Backs a per-IP rate limit on the public /interest form
-- (app/interest/actions.ts), like signup_attempts does for /signup. Each lead
-- records the IP it came from; the form refuses more than a few per hour.

alter table interest_signups add column ip text;

create index interest_signups_ip_created_at_idx
  on interest_signups (ip, created_at);
