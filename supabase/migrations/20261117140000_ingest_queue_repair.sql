-- Manual, repeatable. Apply after ingest-moderation-batch.sql and event-source-scaling.sql.
begin;


create or replace function poruch_private.moderation_venue(p_item jsonb) returns text
language sql immutable set search_path='' as $fn$
 select coalesce(nullif(btrim(p_item->>'place'),''),nullif(btrim(p_item->>'address'),''),
 nullif(btrim(p_item#>>'{raw_data,location,name}'),''),nullif(btrim(p_item#>>'{raw_data,venue,name}'),''),
 case when jsonb_typeof(p_item#>'{raw_data,venue}')='string' then nullif(btrim(p_item#>>'{raw_data,venue}'),'') end,
 nullif(btrim(p_item#>>'{raw_data,location,address,streetAddress}'),''),
 case when jsonb_typeof(p_item#>'{raw_data,location,address}')='string' then nullif(btrim(p_item#>>'{raw_data,location,address}'),'') end,
 case when jsonb_typeof(p_item#>'{raw_data,location}')='string' then nullif(btrim(p_item#>>'{raw_data,location}'),'') end,'');
$fn$;
create or replace function poruch_private.moderation_identity(p_item jsonb) returns text
language sql immutable set search_path='' as $fn$
 select jsonb_build_array(regexp_replace(lower(coalesce(p_item->>'title','')),'[^[:alnum:]]','','g'),
 regexp_replace(lower(coalesce(p_item->>'city','')),'[^[:alnum:]]','','g'),
 regexp_replace(lower(poruch_private.moderation_venue(p_item)),'[^[:alnum:]]','','g'))::text;
$fn$;
create or replace function poruch_private.moderation_reason(p_item jsonb,p_now timestamptz) returns text
language sql stable set search_path='' as $fn$
 select case when (p_item->>'starts_at')::timestamptz is null or (p_item->>'starts_at')::timestamptz<=p_now then 'date'
 when char_length(btrim(coalesce(p_item->>'title','')))<3 then 'title'
 when poruch_private.moderation_venue(p_item)='' then 'venue'
 when p_item->>'event_status' in ('EventCancelled','EventPostponed') then 'event_status' else null end;
$fn$;
revoke all on function poruch_private.moderation_venue(jsonb),poruch_private.moderation_identity(jsonb),poruch_private.moderation_reason(jsonb,timestamptz) from public,anon,authenticated;

create or replace function poruch_private.moderation_batch(
 p_status text,p_ids uuid[] default null,p_versions jsonb default '{}',p_categories jsonb default '{}',
 p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_item public.ingested_events; v_n integer:=0; v_skipped integer:=0; v_scanned integer:=0; v_last_id uuid:=p_after;
 v_snapshot timestamptz:=coalesce(p_snapshot,clock_timestamp()); v_category text; v_reason text; v_canonical uuid; v_reasons jsonb:='{}'; v_examples jsonb:='[]';
begin
 if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 if p_status is null or p_status not in ('approved','rejected') or (p_ids is not null and cardinality(p_ids) not between 1 and 100)
 or p_versions is null or jsonb_typeof(p_versions)<>'object' or p_categories is null or jsonb_typeof(p_categories)<>'object'
 or p_city is null or char_length(p_city)>120 or cardinality(p_sources)>1000 then raise exception 'invalid_moderation'; end if;
 -- Same lock as ingestion: duplicate/changed checks and publication are atomic.
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 for v_item in select e.* from public.ingested_events e where
  (p_ids is not null and e.id=any(p_ids)) or
  (p_ids is null and e.status='pending' and (p_city='' or e.city=p_city) and (p_sources is null or e.source_id=any(p_sources))
   and (p_after is null or e.id>p_after) and e.collected_at<=v_snapshot)
  order by e.id limit 100 for update
 loop
  v_scanned:=v_scanned+1; v_last_id:=v_item.id;
  v_reason:=null;
  if v_item.status<>'pending' then v_reason:='status';
  elsif p_ids is not null and v_item.fingerprint is distinct from (p_versions->>v_item.id::text) then v_reason:='version';
  elsif p_ids is null and v_item.updated_at>v_snapshot then v_reason:='changed_after_start';
  elsif p_status='approved' then v_reason:=poruch_private.moderation_reason(to_jsonb(v_item),now()); end if;
  v_category:=case when p_ids is not null and p_status='approved' then p_categories->>v_item.id::text else null end;
  if v_reason is null and v_category is not null and v_category not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other') then v_reason:='category'; end if;
  if v_reason is null and p_status='approved' then
   -- Only an already published canonical record beats the current candidate.
   -- Pending copies must never mutually block publication. Source aliases are not copies.
   select d.id into v_canonical from public.ingested_events d where d.id<>v_item.id and d.status='approved'
    and (d.dedup_hash=v_item.dedup_hash or (d.starts_at=v_item.starts_at and
      poruch_private.moderation_identity(to_jsonb(d))=poruch_private.moderation_identity(to_jsonb(v_item))))
    order by d.id limit 1;
   if v_canonical is not null then
    v_reason:='duplicate';
    update public.ingested_events as e set status='rejected',raw_data=e.raw_data||jsonb_build_object('moderation_reason','duplicate','duplicate_of',v_canonical),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where e.id=v_item.id;
   end if;
  end if;
  if v_reason is not null then
   v_skipped:=v_skipped+1;
   v_reasons:=jsonb_set(v_reasons,array[v_reason],to_jsonb(coalesce((v_reasons->>v_reason)::integer,0)+1));
   if jsonb_array_length(v_examples)<20 then v_examples:=v_examples||jsonb_build_array(jsonb_build_object('id',v_item.id,'title',v_item.title,'reason',v_reason)); end if;
   continue;
  end if;
  update public.ingested_events as e set status=p_status,category=coalesce(v_category,e.category),place=case when btrim(e.place)='' then poruch_private.moderation_venue(to_jsonb(e)) else e.place end,reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where e.id=v_item.id;
  v_n:=v_n+1;
 end loop;
 if p_ids is not null and cardinality(array(select distinct unnest(p_ids)))>v_scanned then
  v_reasons:=v_reasons||jsonb_build_object('missing',cardinality(array(select distinct unnest(p_ids)))-v_scanned);
  v_skipped:=v_skipped+cardinality(array(select distinct unnest(p_ids)))-v_scanned; end if;
 return jsonb_build_object('processed',v_n,'skipped',v_skipped,'reasons',v_reasons,'examples',v_examples,'cursor',v_last_id,'snapshot',v_snapshot,'done',p_ids is not null or v_scanned<100);
end $fn$;
create or replace function public.poruch_moderation_batch(
 p_status text,p_ids uuid[] default null,p_versions jsonb default '{}',p_categories jsonb default '{}',
 p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language sql security invoker set search_path='' as $fn$
 select poruch_private.moderation_batch(p_status,p_ids,p_versions,p_categories,p_city,p_sources,p_after,p_snapshot);
$fn$;
revoke all on function poruch_private.moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz),public.poruch_moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz) from public,anon,authenticated;
grant execute on function poruch_private.moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz),public.poruch_moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';


create or replace function poruch_private.ingest_expire() returns void
language sql security definer set search_path='' as $fn$
 select pg_catalog.pg_advisory_xact_lock(1760916000);
 update public.ingested_events as e set status='expired',updated_at=now()
 where (e.status='pending' and e.starts_at<=now()) or (e.status='approved' and coalesce(e.ends_at,e.starts_at)<=now());
$fn$;
create or replace function poruch_private.moderation_expire() returns void
language plpgsql security definer set search_path='' as $fn$
begin
 if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 perform poruch_private.ingest_expire();
end $fn$;
create or replace function public.poruch_moderation_expire() returns void language sql security invoker set search_path='' as $fn$ select poruch_private.moderation_expire(); $fn$;
revoke all on function poruch_private.moderation_expire(),public.poruch_moderation_expire() from public,anon,authenticated;
grant execute on function poruch_private.moderation_expire(),public.poruch_moderation_expire() to authenticated;

-- This API cannot accidentally receive visible page IDs. Completion checks remaining IDs,
-- rather than assuming that a short response means the entire queue is exhausted.
create or replace function poruch_private.moderation_filter_batch(p_status text,p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_result jsonb; v_cursor uuid; v_snapshot timestamptz;
begin
 if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 perform poruch_private.ingest_expire();
 v_result:=poruch_private.moderation_batch(p_status::text,null::uuid[],'{}'::jsonb,'{}'::jsonb,p_city::text,p_sources::uuid[],p_after::uuid,p_snapshot::timestamptz);
 v_cursor:=(v_result->>'cursor')::uuid; v_snapshot:=(v_result->>'snapshot')::timestamptz;
 return v_result||jsonb_build_object('api_version',2,'mode','filter','done',not exists(
  select 1 from public.ingested_events e where e.status='pending' and (p_city='' or e.city=p_city)
   and (p_sources is null or e.source_id=any(p_sources)) and (v_cursor is null or e.id>v_cursor) and e.collected_at<=v_snapshot));
end $fn$;
create or replace function public.poruch_moderation_filter_batch(p_status text,p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null) returns jsonb
language sql security invoker set search_path='' as $fn$ select poruch_private.moderation_filter_batch(p_status::text,p_city::text,p_sources::uuid[],p_after::uuid,p_snapshot::timestamptz); $fn$;
revoke all on function poruch_private.moderation_filter_batch(text,text,uuid[],uuid,timestamptz),public.poruch_moderation_filter_batch(text,text,uuid[],uuid,timestamptz) from public,anon,authenticated;
grant execute on function poruch_private.moderation_filter_batch(text,text,uuid[],uuid,timestamptz),public.poruch_moderation_filter_batch(text,text,uuid[],uuid,timestamptz) to authenticated;

-- Identity intentionally excludes the venue: a short listing and a rich Event are one event.
create index if not exists ingested_events_active_start_city on public.ingested_events(starts_at,city) where status in ('pending','approved');
create or replace function poruch_private.moderation_identity(p_item jsonb) returns text
language sql immutable set search_path='' as $fn$
 select jsonb_build_array(regexp_replace(lower(coalesce(p_item->>'title','')),'[^[:alnum:]]','','g'),
 regexp_replace(lower(coalesce(p_item->>'city','')),'[^[:alnum:]]','','g'))::text;
$fn$;
create or replace function poruch_private.ingest_repair(p_id uuid,p_fingerprint text,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 update public.ingested_events as e set
 place=coalesce(nullif(btrim(e.place),''),nullif(btrim(p_fields->>'place'),''),''),
 address=coalesce(nullif(btrim(e.address),''),nullif(btrim(p_fields->>'address'),''),''),
 latitude=coalesce(e.latitude,(p_fields->>'latitude')::double precision),longitude=coalesce(e.longitude,(p_fields->>'longitude')::double precision),
 price_from=coalesce(e.price_from,(p_fields->>'price_from')::numeric),currency=coalesce(e.currency,p_fields->>'currency'),
 cover_url=coalesce(nullif(e.cover_url,''),p_fields->>'cover_url'),updated_at=now()
 where e.id=p_id and e.fingerprint=p_fingerprint and e.status in ('pending','approved') returning to_jsonb(e) into v_result;
 return v_result;
end $fn$;
create or replace function public.poruch_ingest_repair(p_id uuid,p_fingerprint text,p_fields jsonb) returns jsonb language sql security invoker set search_path='' as $fn$ select poruch_private.ingest_repair(p_id,p_fingerprint,p_fields); $fn$;
revoke all on function poruch_private.ingest_repair(uuid,text,jsonb),public.poruch_ingest_repair(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function poruch_private.ingest_repair(uuid,text,jsonb),public.poruch_ingest_repair(uuid,text,jsonb) to service_role;

create or replace function poruch_private.ingest_merge_duplicates(p_after uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_item public.ingested_events; v_best public.ingested_events; v_other public.ingested_events; v_last uuid:=p_after; v_scanned integer:=0; v_merged integer:=0;
begin
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 for v_item in select e.* from public.ingested_events e where (p_after is null or e.id>p_after)
  and e.status in ('pending','approved') order by e.id limit 100 for update loop
  v_last:=v_item.id; v_scanned:=v_scanned+1;
  select d.* into v_best from public.ingested_events d where d.status in ('pending','approved') and d.starts_at=v_item.starts_at
   and poruch_private.moderation_identity(to_jsonb(d))=poruch_private.moderation_identity(to_jsonb(v_item))
   order by ((nullif(btrim(d.place),'') is not null)::integer*8+(nullif(btrim(d.address),'') is not null)::integer*4+
    (d.latitude is not null and d.longitude is not null)::integer*4+(d.price_from is not null)::integer+(d.cover_url is not null)::integer) desc,d.id limit 1 for update;
  if v_best.id is null then continue; end if;
  for v_other in select d.* from public.ingested_events d where d.id<>v_best.id and d.status in ('pending','approved') and d.starts_at=v_best.starts_at
   and poruch_private.moderation_identity(to_jsonb(d))=poruch_private.moderation_identity(to_jsonb(v_best)) order by d.id for update loop
   update public.ingested_events as e set place=coalesce(nullif(e.place,''),nullif(v_other.place,''),''),address=coalesce(nullif(e.address,''),nullif(v_other.address,''),''),
    latitude=coalesce(e.latitude,v_other.latitude),longitude=coalesce(e.longitude,v_other.longitude),price_from=coalesce(e.price_from,v_other.price_from),
    currency=coalesce(e.currency,v_other.currency),cover_url=coalesce(e.cover_url,v_other.cover_url),
    source_keys=array(select distinct k from unnest(e.source_keys||v_other.source_keys) as k),observations=v_other.observations||e.observations,
    status=case when e.status='approved' or v_other.status='approved' then 'approved' else e.status end,updated_at=now() where e.id=v_best.id;
   update public.ingested_events as e set status='rejected',source_keys='{}',observations='{}',raw_data=e.raw_data||jsonb_build_object('moderation_reason','duplicate','duplicate_of',v_best.id),updated_at=now() where e.id=v_other.id;
   v_merged:=v_merged+1;
  end loop;
 end loop;
 return jsonb_build_object('done',v_scanned<100,'cursor',v_last,'merged',v_merged);
end $fn$;
create or replace function public.poruch_ingest_merge_duplicates(p_after uuid default null) returns jsonb language sql security invoker set search_path='' as $fn$ select poruch_private.ingest_merge_duplicates(p_after); $fn$;
revoke all on function poruch_private.ingest_merge_duplicates(uuid),public.poruch_ingest_merge_duplicates(uuid) from public,anon,authenticated;
grant execute on function poruch_private.ingest_merge_duplicates(uuid),public.poruch_ingest_merge_duplicates(uuid) to service_role;

-- Retain the proven alias/version merger and fill missing facts rather than overwriting them.
create or replace function poruch_private.ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text
language plpgsql security definer set search_path='' as $fn$
declare v_best public.ingested_events; v_result text; v_auto boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 select s.auto_publish into v_auto from public.event_sources s where s.id=p_source and s.enabled and s.run_token=p_token;
 select e.* into v_best from public.ingested_events e where e.status in ('pending','approved') and e.starts_at=(p_item->>'starts_at')::timestamptz
  and poruch_private.moderation_identity(to_jsonb(e))=poruch_private.moderation_identity(p_item) order by (e.status='approved') desc,e.id limit 1;
 if v_best.id is not null then
  p_item:=p_item||jsonb_build_object('dedup_hash',v_best.dedup_hash,
   'place',coalesce(nullif(btrim(p_item->>'place'),''),v_best.place),'address',coalesce(nullif(btrim(p_item->>'address'),''),v_best.address),
   'latitude',coalesce((p_item->>'latitude')::double precision,v_best.latitude),'longitude',coalesce((p_item->>'longitude')::double precision,v_best.longitude),
   'price_from',coalesce((p_item->>'price_from')::numeric,v_best.price_from),'currency',coalesce(p_item->>'currency',v_best.currency),'cover_url',coalesce(p_item->>'cover_url',v_best.cover_url));
 end if;
 v_result:=poruch_private.ingest_item_core(p_source,p_token,p_item);
 -- Duplicate source observations may carry richer facts; repair these even when the core returns unchanged/duplicate.
 select e.* into v_best from public.ingested_events e where e.source_keys @> array[p_source::text||':'||(p_item->>'external_id')];
 if v_best.id is not null then
  perform poruch_private.ingest_repair(v_best.id,v_best.fingerprint,p_item);
  if v_auto and v_best.status='pending' and poruch_private.moderation_reason(p_item,now()) is null then
   update public.ingested_events as e set status='approved',reviewed_at=now(),reviewed_by=null where e.id=v_best.id;
  end if;
 end if;
 return v_result;
end $fn$;
revoke all on function poruch_private.ingest_item(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function poruch_private.ingest_item(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
