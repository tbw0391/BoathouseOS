-- Each member's own order for the shortcut buttons on their profile (hrefs,
-- first to last). Null means the club's default order. Buttons the admin
-- turns on later that aren't in the list go at the end. Members update this
-- on their own row through the existing "update their own profile" policy;
-- it isn't a privileged column.

alter table profiles
  add column if not exists profile_button_order text[];
