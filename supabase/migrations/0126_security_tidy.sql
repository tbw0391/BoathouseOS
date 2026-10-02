-- Security advisor tidy-up. Both functions are plain distance math (no table
-- access); pinning search_path just silences "role mutable search_path".
-- cos/radians/sqrt/power live in pg_catalog, which is always searched.
alter function public.course_progress(double precision, double precision, double precision, double precision, double precision, double precision)
  set search_path = '';
alter function public.near_distance_m(double precision, double precision, double precision, double precision)
  set search_path = '';

-- A leftover test function on the demo database (never in a migration).
drop function if exists public.zz_test_fn();
