-- Erg PR times, stored as free-form text (e.g. "6:45.2") since rowing
-- convention is mm:ss.t rather than a plain duration.

alter table profiles
  add column if not exists erg_2k_time text,
  add column if not exists erg_5k_time text;
