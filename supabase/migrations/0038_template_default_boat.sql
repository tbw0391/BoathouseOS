-- A lineup template can now carry a default physical boat from the fleet.
-- It's just a default: applying the template to a race still lets the
-- coach pick a different boat of the same class (e.g. if the usual shell
-- is damaged that day).
alter table lineup_templates
  add column if not exists boat_id uuid references boats (id) on delete set null;
