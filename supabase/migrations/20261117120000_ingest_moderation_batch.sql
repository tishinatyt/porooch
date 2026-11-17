-- Apply manually after event-source-scaling.sql and ingested-event-category.sql.
-- Legacy poruch_ingest_moderate overloads remain for older clients; this RPC calls neither.
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
commit;
