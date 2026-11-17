-- Apply manually after event-source-scaling.sql and ingested-event-category.sql.
-- Legacy poruch_ingest_moderate overloads remain for older clients; this RPC calls neither.
begin;
create or replace function poruch_private.moderation_batch(
 p_status text,p_ids uuid[] default null,p_versions jsonb default '{}',p_categories jsonb default '{}',
 p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item public.ingested_events; v_n integer:=0; v_skipped integer:=0; v_scanned integer:=0; v_last_id uuid:=p_after;
 v_snapshot timestamptz:=coalesce(p_snapshot,clock_timestamp()); v_category text;
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
  if v_item.status<>'pending' or (p_ids is not null and v_item.fingerprint is distinct from (p_versions->>v_item.id::text))
   or (p_ids is null and v_item.updated_at>v_snapshot) then v_skipped:=v_skipped+1; continue; end if;
  if p_status='approved' and (v_item.starts_at<=now() or char_length(btrim(v_item.title))<3
   or (btrim(coalesce(v_item.place,''))='' and btrim(coalesce(v_item.address,''))='')
   or v_item.event_status in ('EventCancelled','EventPostponed')
   or exists(select 1 from public.ingested_events d where d.id<>v_item.id and d.dedup_hash=v_item.dedup_hash)) then
   v_skipped:=v_skipped+1; continue;
  end if;
  v_category:=case when p_ids is not null and p_status='approved' then p_categories->>v_item.id::text else null end;
  if v_category is not null and v_category not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other') then v_skipped:=v_skipped+1; continue; end if;
  update public.ingested_events as e set status=p_status,category=coalesce(v_category,e.category),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where e.id=v_item.id;
  v_n:=v_n+1;
 end loop;
 if p_ids is not null then v_skipped:=v_skipped+cardinality(array(select distinct unnest(p_ids)))-v_scanned; end if;
 return jsonb_build_object('processed',v_n,'skipped',v_skipped,'cursor',v_last_id,'snapshot',v_snapshot,'done',p_ids is not null or v_scanned<100);
end $$;
create or replace function public.poruch_moderation_batch(
 p_status text,p_ids uuid[] default null,p_versions jsonb default '{}',p_categories jsonb default '{}',
 p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language sql security invoker set search_path='' as $$
 select poruch_private.moderation_batch(p_status,p_ids,p_versions,p_categories,p_city,p_sources,p_after,p_snapshot);
$$;
revoke all on function poruch_private.moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz),public.poruch_moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz) from public,anon,authenticated;
grant execute on function poruch_private.moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz),public.poruch_moderation_batch(text,uuid[],jsonb,jsonb,text,uuid[],uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
