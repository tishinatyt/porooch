-- Apply manually after 20261027085654_poruch_admin_console.sql.
-- External facts stay separate from user events. No automatic publication.
begin;
create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  type text not null check (type in ('schema_org','feed','telegram','manual')),
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  city text not null check (char_length(city) between 1 and 120),
  default_category text not null default 'other',
  enabled boolean not null default false,
  auto_publish boolean not null default false, -- reserved; intentionally ignored by ingestion
  partner_params text not null default '' check (char_length(partner_params) <= 500),
  last_run_at timestamptz, last_finished_at timestamptz,
  last_result text, last_found integer not null default 0, last_changed integer not null default 0,
  run_count bigint not null default 0, found_count bigint not null default 0, changed_count bigint not null default 0,
  run_token uuid, created_at timestamptz not null default now()
);
create table public.ingested_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.event_sources(id), external_id text not null,
  title text not null check (char_length(title) between 1 and 300),
  starts_at timestamptz not null, ends_at timestamptz check (ends_at >= starts_at),
  place text not null default '', address text not null default '',
  latitude double precision check (latitude between -90 and 90), longitude double precision check (longitude between -180 and 180),
  city text not null, category text not null default 'other',
  price_from numeric check (price_from >= 0), currency text,
  source_url text not null check (source_url ~ '^https?://'),
  cover_url text check (cover_url ~ '^https?://'),
  description text not null default '' check (char_length(description) <= 200),
  event_status text not null default 'EventScheduled',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  dedup_hash text not null unique check (dedup_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  -- Preserve source identities across deduplication and rescheduling.
  source_keys text[] not null default '{}', observations jsonb not null default '{}',
  raw_data jsonb not null default '{}' check (char_length(coalesce(raw_data->>'description','')) <= 200),
  collected_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid
);
create index ingested_events_moderation on public.ingested_events(status,city,source_id,starts_at,id);
create index ingested_events_source_keys on public.ingested_events using gin(source_keys);
alter table public.event_sources enable row level security;
alter table public.ingested_events enable row level security;
revoke all on public.event_sources,public.ingested_events from public,anon,authenticated;
grant select,insert,update on public.event_sources to authenticated;
grant select on public.ingested_events to authenticated;
grant all on public.event_sources,public.ingested_events to service_role;
create policy poruch_sources_admin on public.event_sources for all to authenticated
  using ((select poruch_private.is_admin())) with check ((select poruch_private.is_admin()));
create policy poruch_ingested_admin_read on public.ingested_events for select to authenticated
  using ((select poruch_private.is_admin()));

create function poruch_private.ingest_claim(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  update public.event_sources set last_run_at=now(),last_finished_at=null,last_result='running',run_token=gen_random_uuid(),run_count=run_count+1
  where id=p_id and enabled and (last_run_at is null or last_run_at <= now()-interval '24 hours') returning run_token into token;
  return token;
end $$;
create function public.poruch_ingest_claim(p_id uuid) returns uuid language sql security invoker set search_path='' as $$ select poruch_private.ingest_claim(p_id); $$;

create function poruch_private.ingest_finish(p_id uuid,p_token uuid,p_found integer,p_changed integer,p_result text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_found < 0 or p_changed < 0 or p_result !~ '^[a-z_0-9]{1,80}$' then raise exception 'invalid_run_result'; end if;
  update public.event_sources set last_finished_at=now(),last_result=p_result,last_found=p_found,last_changed=p_changed,
    found_count=found_count+p_found,changed_count=changed_count+p_changed,run_token=null
  where id=p_id and run_token=p_token;
end $$;
create function public.poruch_ingest_finish(p_id uuid,p_token uuid,p_found integer,p_changed integer,p_result text) returns void language sql security invoker set search_path='' as $$ select poruch_private.ingest_finish(p_id,p_token,p_found,p_changed,p_result); $$;

create function poruch_private.ingest_expire() returns void language sql security definer set search_path='' as $$
  update public.ingested_events set status='expired',updated_at=now() where status <> 'expired' and coalesce(ends_at,starts_at) < now();
$$;
create function public.poruch_ingest_expire() returns void language sql security invoker set search_path='' as $$ select poruch_private.ingest_expire(); $$;

create function poruch_private.ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
  k text := p_source::text || ':' || (p_item->>'external_id');
  old public.ingested_events; target public.ingested_events; chosen uuid;
  keys text[] := '{}'; observations jsonb := '{}'; changed boolean := false;
begin
  if not exists(select 1 from public.event_sources where id=p_source and run_token=p_token and enabled and last_run_at > now()-interval '3 hours') then raise exception 'invalid_run_token'; end if;
  if p_item->>'external_id' is null or char_length(p_item->>'external_id') > 1000 or p_item->>'fingerprint' !~ '^[a-f0-9]{64}$' then raise exception 'invalid_item'; end if;
  -- Serialize the small canonical merge, including aliases, across workers/sources.
  perform pg_catalog.pg_advisory_xact_lock(1760916000);
  select * into old from public.ingested_events where source_keys @> array[k] for update;
  if old.id is not null and old.observations->>k = p_item->>'fingerprint' then
    update public.ingested_events set collected_at=now() where id=old.id;
    return 'unchanged';
  end if;
  select * into target from public.ingested_events where dedup_hash=p_item->>'dedup_hash' for update;
  if old.id is null and target.id is not null and not (p_item->>'event_status' in ('EventCancelled','EventPostponed') and target.event_status is distinct from p_item->>'event_status') then
    update public.ingested_events e set source_keys=array_append(e.source_keys,k), observations=e.observations || jsonb_build_object(k,p_item->>'fingerprint'),collected_at=now()
    where id=target.id;
    return 'duplicate';
  end if;
  chosen := coalesce(old.id,target.id,gen_random_uuid());
  keys := coalesce(old.source_keys,target.source_keys,'{}'); observations := coalesce(old.observations,target.observations,'{}');
  if old.id is not null and target.id is not null and old.id<>target.id then
    chosen := target.id;
    keys := keys || target.source_keys; observations := observations || target.observations;
    delete from public.ingested_events where id=old.id;
  end if;
  select array_agg(distinct key) into keys from unnest(keys || array[k]) key;
  observations := observations || jsonb_build_object(k,p_item->>'fingerprint');
  changed := old.id is not null or target.id is not null;
  insert into public.ingested_events(id,source_id,external_id,title,starts_at,ends_at,place,address,latitude,longitude,city,category,
    price_from,currency,source_url,cover_url,description,event_status,dedup_hash,fingerprint,source_keys,observations,raw_data,status)
  values(chosen,p_source,p_item->>'external_id',p_item->>'title',(p_item->>'starts_at')::timestamptz,(p_item->>'ends_at')::timestamptz,
    p_item->>'place',p_item->>'address',(p_item->>'latitude')::double precision,(p_item->>'longitude')::double precision,p_item->>'city',p_item->>'category',
    (p_item->>'price_from')::numeric,p_item->>'currency',p_item->>'source_url',p_item->>'cover_url',left(coalesce(p_item->>'description',''),200),
    p_item->>'event_status',p_item->>'dedup_hash',p_item->>'fingerprint',keys,observations,coalesce(p_item->'raw_data','{}'),
    case when coalesce((p_item->>'ends_at')::timestamptz,(p_item->>'starts_at')::timestamptz) < now() then 'expired' else 'pending' end)
  on conflict(id) do update set source_id=excluded.source_id,external_id=excluded.external_id,title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
    place=excluded.place,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,city=excluded.city,category=excluded.category,
    price_from=excluded.price_from,currency=excluded.currency,source_url=excluded.source_url,cover_url=excluded.cover_url,description=excluded.description,
    event_status=excluded.event_status,dedup_hash=excluded.dedup_hash,fingerprint=excluded.fingerprint,source_keys=excluded.source_keys,observations=excluded.observations,
    raw_data=excluded.raw_data,status=excluded.status,collected_at=now(),updated_at=now(),reviewed_at=null,reviewed_by=null;
  return case when changed then 'updated' else 'inserted' end;
end $$;
create function public.poruch_ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text language sql security invoker set search_path='' as $$ select poruch_private.ingest_item(p_source,p_token,p_item); $$;

create function poruch_private.ingest_moderate(p_ids uuid[],p_status text,p_versions jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare item public.ingested_events; v_id uuid; n integer := 0;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  if p_status is null or p_ids is null or p_versions is null or p_status not in ('approved','rejected') or cardinality(p_ids) not between 1 and 100 then raise exception 'invalid_moderation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1760916000);
  foreach v_id in array p_ids loop
    select * into item from public.ingested_events where id=v_id for update;
    if item.id is null or item.status<>'pending' or item.fingerprint is distinct from (p_versions->>item.id::text) then raise exception 'event_changed'; end if;
    if p_status='approved' and (coalesce(item.ends_at,item.starts_at) <= now() or item.event_status in ('EventCancelled','EventPostponed')) then raise exception 'event_unpublishable'; end if;
    update public.ingested_events set status=p_status,reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=item.id;
    n := n+1;
  end loop;
  return n;
end $$;
create function public.poruch_ingest_moderate(p_ids uuid[],p_status text,p_versions jsonb) returns integer language sql security invoker set search_path='' as $$ select poruch_private.ingest_moderate(p_ids,p_status,p_versions); $$;

-- Only this allowlisted projection is public; raw data, pending items and source config remain admin-only.
create function poruch_private.ingest_feed(p_city text,p_category text,p_search text,p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_city is null or p_category is null or p_offset is null or p_limit is null or char_length(p_city)>120 or char_length(p_search)>200 or p_offset<0 or p_limit not between 1 and 100 then raise exception 'invalid_feed_filters'; end if;
  return coalesce((select jsonb_agg(to_jsonb(v)) from (
    select e.id,e.title,e.starts_at,e.ends_at,e.place,e.address,e.latitude,e.longitude,e.city,e.category,e.price_from,e.currency,e.source_url,e.cover_url,e.description,
      s.name as source_name,s.partner_params
    from public.ingested_events e join public.event_sources s on s.id=e.source_id
    where e.status='approved' and coalesce(e.ends_at,e.starts_at)>now() and e.event_status not in ('EventCancelled','EventPostponed')
      and lower(e.city)=lower(btrim(p_city)) and (p_category='all' or e.category=p_category)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(e.title||' '||e.place||' '||e.address))>0)
    order by e.starts_at,e.id offset p_offset limit p_limit
  ) v),'[]'::jsonb);
end $$;
create function public.poruch_ingest_feed(p_city text,p_category text default 'all',p_search text default '',p_offset integer default 0,p_limit integer default 100) returns jsonb
language sql stable security invoker set search_path='' as $$ select poruch_private.ingest_feed(p_city,p_category,p_search,p_offset,p_limit); $$;

revoke all on function poruch_private.ingest_claim(uuid),public.poruch_ingest_claim(uuid),
  poruch_private.ingest_finish(uuid,uuid,integer,integer,text),public.poruch_ingest_finish(uuid,uuid,integer,integer,text),
  poruch_private.ingest_expire(),public.poruch_ingest_expire(),poruch_private.ingest_item(uuid,uuid,jsonb),public.poruch_ingest_item(uuid,uuid,jsonb),
  poruch_private.ingest_moderate(uuid[],text,jsonb),public.poruch_ingest_moderate(uuid[],text,jsonb),
  poruch_private.ingest_feed(text,text,text,integer,integer),public.poruch_ingest_feed(text,text,text,integer,integer) from public,anon,authenticated;
grant usage on schema poruch_private to service_role,anon;
grant execute on function poruch_private.ingest_claim(uuid),public.poruch_ingest_claim(uuid),
  poruch_private.ingest_finish(uuid,uuid,integer,integer,text),public.poruch_ingest_finish(uuid,uuid,integer,integer,text),
  poruch_private.ingest_expire(),public.poruch_ingest_expire(),poruch_private.ingest_item(uuid,uuid,jsonb),public.poruch_ingest_item(uuid,uuid,jsonb) to service_role;
grant execute on function poruch_private.ingest_moderate(uuid[],text,jsonb),public.poruch_ingest_moderate(uuid[],text,jsonb) to authenticated;
grant execute on function poruch_private.ingest_feed(text,text,text,integer,integer),public.poruch_ingest_feed(text,text,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
