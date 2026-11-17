-- Apply manually after event-source-scaling.sql and ingested-event-category.sql.
begin;
create or replace function poruch_private.moderation_batch(
 p_status text,p_ids uuid[] default null,p_versions jsonb default '{}',p_categories jsonb default '{}',
 p_city text default '',p_sources uuid[] default null,p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.ingested_events; n integer:=0; skipped integer:=0; scanned integer:=0; last_id uuid:=p_after;
 snapshot timestamptz:=coalesce(p_snapshot,clock_timestamp()); category text;
begin
 if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 if p_status is null or p_status not in ('approved','rejected') or (p_ids is not null and cardinality(p_ids) not between 1 and 100)
 or p_versions is null or jsonb_typeof(p_versions)<>'object' or p_categories is null or jsonb_typeof(p_categories)<>'object'
 or p_city is null or char_length(p_city)>120 or cardinality(p_sources)>1000 then raise exception 'invalid_moderation'; end if;
 -- Same lock as ingestion: duplicate/changed checks and publication are atomic.
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 for item in select e.* from public.ingested_events e where
  (p_ids is not null and e.id=any(p_ids)) or
  (p_ids is null and e.status='pending' and (p_city='' or e.city=p_city) and (p_sources is null or e.source_id=any(p_sources))
   and (p_after is null or e.id>p_after) and e.collected_at<=snapshot)
  order by e.id limit 100 for update
 loop
  scanned:=scanned+1; last_id:=item.id;
  if item.status<>'pending' or (p_ids is not null and item.fingerprint is distinct from (p_versions->>item.id::text))
   or (p_ids is null and item.updated_at>snapshot) then skipped:=skipped+1; continue; end if;
  if p_status='approved' and (item.starts_at<=now() or char_length(btrim(item.title))<3
   or (btrim(coalesce(item.place,''))='' and btrim(coalesce(item.address,''))='')
   or item.event_status in ('EventCancelled','EventPostponed')
   or exists(select 1 from public.ingested_events d where d.id<>item.id and d.dedup_hash=item.dedup_hash)) then
   skipped:=skipped+1; continue;
  end if;
  category:=case when p_ids is not null and p_status='approved' then p_categories->>item.id::text else null end;
  if category is not null and category not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other') then skipped:=skipped+1; continue; end if;
  update public.ingested_events set status=p_status,category=coalesce(category,item.category),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=item.id;
  n:=n+1;
 end loop;
 if p_ids is not null then skipped:=skipped+cardinality(array(select distinct unnest(p_ids)))-scanned; end if;
 return jsonb_build_object('processed',n,'skipped',skipped,'cursor',last_id,'snapshot',snapshot,'done',p_ids is not null or scanned<100);
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
