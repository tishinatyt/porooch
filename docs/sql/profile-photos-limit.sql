-- 1. Read-only check: users whose profile gallery exceeds six photos.
select id, name, cardinality(profile_photos) as photo_count
from public.users
where cardinality(profile_photos) > 6
order by photo_count desc, id;

-- 2. выполнять только если первый запрос пуст
-- Run this block separately. Matches migration 015.
begin;
alter table public.users
  drop constraint if exists users_profile_photos_max_six;
alter table public.users
  add constraint users_profile_photos_max_six
  check (cardinality(profile_photos) <= 6);
commit;
