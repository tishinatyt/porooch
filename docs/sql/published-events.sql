-- Manual, repeatable. Apply after ingest-queue-repair.sql. No sessions are merged here.
begin;
create table if not exists poruch_private.ingest_hidden_keys (
 key text primary key,
 hidden_at timestamptz not null default now(),
 hidden_by uuid
);
alter table poruch_private.ingest_hidden_keys enable row level security;
revoke all on table poruch_private.ingest_hidden_keys from public,anon,authenticated,service_role;

create or replace function poruch_private.ingest_hide_keys(p_item jsonb) returns text[]
language sql stable set search_path='' as $fn$
 select array['identity:'||poruch_private.moderation_identity(p_item)||':'||extract(epoch from (p_item->>'starts_at')::timestamptz)::text]
  || array(select 'source:'||k.value from jsonb_array_elements_text(coalesce(p_item->'source_keys','[]'::jsonb)) as k(value));
$fn$;
create or replace function poruch_private.ingest_is_hidden(p_item jsonb) returns boolean
language sql stable security definer set search_path='' as $fn$
 select coalesce(p_item#>>'{raw_data,moderation_reason}','')='hidden' or exists(
  select 1 from poruch_private.ingest_hidden_keys h where h.key=any(poruch_private.ingest_hide_keys(p_item)));
$fn$;
create or replace function poruch_private.ingest_keep_hidden() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare v_hidden boolean:=false;
begin
 if TG_OP='UPDATE' then v_hidden:=old.raw_data->>'moderation_reason'='hidden'; end if;
 if coalesce(v_hidden,false) or poruch_private.ingest_is_hidden(to_jsonb(new)) then
  new.status:='rejected';
  new.raw_data:=new.raw_data||jsonb_build_object('moderation_reason','hidden');
 end if;
 return new;
end $fn$;
drop trigger if exists poruch_ingest_keep_hidden on public.ingested_events;
create trigger poruch_ingest_keep_hidden before insert or update on public.ingested_events for each row execute function poruch_private.ingest_keep_hidden();
revoke all on function poruch_private.ingest_hide_keys(jsonb),poruch_private.ingest_is_hidden(jsonb),poruch_private.ingest_keep_hidden() from public,anon,authenticated,service_role;
insert into poruch_private.ingest_hidden_keys(key,hidden_by)
 select k.value,e.reviewed_by from public.ingested_events e cross join lateral unnest(poruch_private.ingest_hide_keys(to_jsonb(e))) as k(value)
 where e.raw_data->>'moderation_reason'='hidden' on conflict(key) do nothing;

-- Preserve the previous collector implementation behind a permanent-hide check.
do $fn$
begin
 if to_regprocedure('poruch_private.ingest_item_visible(uuid,uuid,jsonb)') is null then
  alter function poruch_private.ingest_item(uuid,uuid,jsonb) rename to ingest_item_visible;
 end if;
end $fn$;
create or replace function poruch_private.ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text
language plpgsql security definer set search_path='' as $fn$
begin
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 if not exists(select 1 from public.event_sources s where s.id=p_source and s.enabled and s.run_token=p_token and s.last_run_at>now()-interval '3 hours') then raise exception 'invalid_run_token'; end if;
 if poruch_private.ingest_is_hidden(p_item||jsonb_build_object('source_keys',jsonb_build_array(p_source::text||':'||(p_item->>'external_id')))) then return 'hidden'; end if;
 return poruch_private.ingest_item_visible(p_source,p_token,p_item);
end $fn$;
revoke all on function poruch_private.ingest_item_visible(uuid,uuid,jsonb),poruch_private.ingest_item(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function poruch_private.ingest_item(uuid,uuid,jsonb) to service_role;

create or replace function poruch_private.published_batch(
 p_action text,p_category text default null,p_ids uuid[] default null,p_versions jsonb default '{}',
 p_city text default '',p_source uuid default null,p_filter_category text default '',p_search text default '',
 p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_item public.ingested_events; v_snapshot timestamptz:=coalesce(p_snapshot,clock_timestamp());
 v_after uuid:=p_after; v_processed integer:=0; v_skipped integer:=0; v_scanned integer:=0;
begin
 if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 if p_action is null or p_action not in ('unpublish','hide','category') or p_city is null or p_search is null or p_filter_category is null
  or char_length(p_city)>120 or char_length(p_search)>200 or p_versions is null or jsonb_typeof(p_versions)<>'object'
  or (p_ids is not null and cardinality(p_ids) not between 1 and 100) then raise exception 'invalid_published_action'; end if;
 if p_action='category' and (p_category is null or p_category not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other')) then raise exception 'invalid_category'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1760916000);
 for v_item in select e.* from public.ingested_events e where
  (p_ids is not null and e.id=any(p_ids)) or
  (p_ids is null and e.status='approved' and (p_city='' or e.city=p_city) and (p_source is null or e.source_id=p_source)
    and (p_filter_category='' or e.category=p_filter_category) and (p_search='' or position(lower(p_search) in lower(e.title))>0)
    and (p_after is null or e.id>p_after) and e.collected_at<=v_snapshot)
  order by e.id limit 100 for update
 loop
  v_scanned:=v_scanned+1; v_after:=v_item.id;
  if v_item.status<>'approved' or (p_ids is null and v_item.updated_at>v_snapshot)
    or (p_ids is not null and v_item.updated_at is distinct from (p_versions->>v_item.id::text)::timestamptz) then
   v_skipped:=v_skipped+1; continue;
  end if;
  if p_action='hide' then
   insert into poruch_private.ingest_hidden_keys(key,hidden_by)
    select k.value,auth.uid() from unnest(poruch_private.ingest_hide_keys(to_jsonb(v_item))) as k(value) on conflict(key) do nothing;
  end if;
  update public.ingested_events as e set
    status=case p_action when 'unpublish' then 'pending' when 'hide' then 'rejected' else e.status end,
    category=case when p_action='category' then p_category else e.category end,
    raw_data=case when p_action='hide' then e.raw_data||jsonb_build_object('moderation_reason','hidden') else e.raw_data end,
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where e.id=v_item.id;
  v_processed:=v_processed+1;
 end loop;
 if p_ids is not null then v_skipped:=v_skipped+cardinality(array(select distinct unnest(p_ids)))-v_scanned; end if;
 return jsonb_build_object('processed',v_processed,'skipped',v_skipped,'cursor',v_after,'snapshot',v_snapshot,
  'done',p_ids is not null or not exists(select 1 from public.ingested_events e where e.status='approved'
   and (p_city='' or e.city=p_city) and (p_source is null or e.source_id=p_source)
   and (p_filter_category='' or e.category=p_filter_category) and (p_search='' or position(lower(p_search) in lower(e.title))>0)
   and (v_after is null or e.id>v_after) and e.collected_at<=v_snapshot));
end $fn$;
create or replace function public.poruch_published_batch(
 p_action text,p_category text default null,p_ids uuid[] default null,p_versions jsonb default '{}',
 p_city text default '',p_source uuid default null,p_filter_category text default '',p_search text default '',
 p_after uuid default null,p_snapshot timestamptz default null
) returns jsonb language sql security invoker set search_path='' as $fn$
 select poruch_private.published_batch(p_action::text,p_category::text,p_ids::uuid[],p_versions::jsonb,p_city::text,p_source::uuid,p_filter_category::text,p_search::text,p_after::uuid,p_snapshot::timestamptz);
$fn$;
revoke all on function poruch_private.published_batch(text,text,uuid[],jsonb,text,uuid,text,text,uuid,timestamptz),public.poruch_published_batch(text,text,uuid[],jsonb,text,uuid,text,text,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function poruch_private.published_batch(text,text,uuid[],jsonb,text,uuid,text,text,uuid,timestamptz),public.poruch_published_batch(text,text,uuid[],jsonb,text,uuid,text,text,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
