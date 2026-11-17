-- READ ONLY. Change only the city value below. No RPC or writes.
with params(city) as (values ('Київ'::text)), facts as (
 select e.*,coalesce(nullif(btrim(e.place),''),nullif(btrim(e.address),''),
 nullif(btrim(e.raw_data#>>'{location,name}'),''),nullif(btrim(e.raw_data#>>'{venue,name}'),''),
 case when jsonb_typeof(e.raw_data->'venue')='string' then nullif(btrim(e.raw_data->>'venue'),'') end,
 nullif(btrim(e.raw_data#>>'{location,address,streetAddress}'),''),
 case when jsonb_typeof(e.raw_data#>'{location,address}')='string' then nullif(btrim(e.raw_data#>>'{location,address}'),'') end,
 case when jsonb_typeof(e.raw_data->'location')='string' then nullif(btrim(e.raw_data->>'location'),'') end,'') as effective_venue
 from public.ingested_events e
), keyed as (
 select f.*,jsonb_build_array(regexp_replace(lower(f.title),'[^[:alnum:]]','','g'),
 regexp_replace(lower(f.city),'[^[:alnum:]]','','g'),regexp_replace(lower(f.effective_venue),'[^[:alnum:]]','','g'))::text as identity_key
 from facts f
)
select e.id,e.title,e.city,e.category,e.source_id,e.starts_at,e.starts_at at time zone 'Europe/Kyiv' as start_kyiv,
 e.place,e.address,e.effective_venue,e.collected_at,e.updated_at,e.fingerprint,cardinality(e.source_keys) as source_aliases,
 (e.starts_at>now()) as date_ok,(char_length(btrim(e.title))>=3) as title_ok,
 (btrim(e.place)<>'' or btrim(e.address)<>'') as old_venue_ok,(e.effective_venue<>'') as venue_ok,
 (e.event_status not in ('EventCancelled','EventPostponed')) as event_status_ok,(e.status='pending') as status_ok,
 true as category_ok_no_override,true as version_ok_filter_has_no_client_version,
 (e.updated_at<=clock_timestamp()) as snapshot_ok_at_query_time,
 not exists(select 1 from keyed d where d.id<>e.id and d.dedup_hash=e.dedup_hash) as old_duplicate_ok,
 not exists(select 1 from keyed d where d.id<>e.id and d.status='approved' and
  (d.dedup_hash=e.dedup_hash or (d.starts_at=e.starts_at and d.identity_key=e.identity_key))) as no_approved_duplicate,
 (select count(*) from keyed d where d.id<>e.id and d.starts_at=e.starts_at and d.identity_key=e.identity_key and d.status='pending') as pending_copies
from keyed e cross join params p where e.status='pending' and e.city=p.city order by e.starts_at,e.id;
