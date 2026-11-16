-- Optional persistent cache; collection/backfill also work with local/Actions file cache.
begin;
create table if not exists public.venue_geocode_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  place text not null default '', address text not null default '', city text not null,
  query text not null, latitude double precision, longitude double precision,
  status text not null check (status in ('found','not_found','error')),
  provider text not null, updated_at timestamptz not null default now(), retry_after timestamptz,
  constraint venue_geocode_coordinate_pair check (
    (status='found' and latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
    or (status in ('not_found','error') and latitude is null and longitude is null)
  )
);
alter table public.venue_geocode_cache enable row level security;
revoke all on public.venue_geocode_cache from public,anon,authenticated;
grant select,insert,update on public.venue_geocode_cache to service_role;
notify pgrst,'reload schema';
commit;
