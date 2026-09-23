-- Hull color and rig, captured on the Add Boat form (lib/boatOptions.ts has
-- the option lists these checks must stay in sync with).

alter table boats
  add column if not exists hull_color text
    check (hull_color in ('white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'silver')),
  add column if not exists rig text
    check (rig in ('port', 'starboard', 'port_bucket', 'starboard_bucket', 'scull'));
