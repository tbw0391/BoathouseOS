-- Walk up song, shown/edited on a member's bio (everyone, not just parents).
alter table profiles
  add column if not exists walk_up_song text;
