-- Apply after event_ingest; preferably after event_sources_images. No application is automatic.
begin;
-- Preserve the three-argument API. The new overload atomically reviews + saves category overrides.
create or replace function poruch_private.ingest_moderate(p_ids uuid[],p_status text,p_versions jsonb,p_categories jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  if p_categories is null or jsonb_typeof(p_categories)<>'object' or p_status is distinct from 'approved' then raise exception 'invalid_categories'; end if;
  if exists(select 1 from jsonb_each_text(p_categories) c where
    c.key not in (select id::text from unnest(p_ids) id) or c.value is null or
    c.value not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other')) then raise exception 'invalid_categories'; end if;
  n := poruch_private.ingest_moderate(p_ids::uuid[],p_status::text,p_versions::jsonb);
  -- fingerprint/observations describe source facts. Keep them so the next identical crawl
  -- preserves a moderator's category; changed source facts still return the event to pending.
  update public.ingested_events e set category=p_categories->>e.id::text,updated_at=now()
    where e.id=any(p_ids) and p_categories ? e.id::text;
  return n;
end $$;
create or replace function public.poruch_ingest_moderate(p_ids uuid[],p_status text,p_versions jsonb,p_categories jsonb) returns integer
language sql security invoker set search_path='' as $$ select poruch_private.ingest_moderate(p_ids::uuid[],p_status::text,p_versions::jsonb,p_categories::jsonb); $$;
revoke all on function poruch_private.ingest_moderate(uuid[],text,jsonb,jsonb),public.poruch_ingest_moderate(uuid[],text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function poruch_private.ingest_moderate(uuid[],text,jsonb,jsonb),public.poruch_ingest_moderate(uuid[],text,jsonb,jsonb) to authenticated;

-- Add the human-readable status input to the existing public allowlist.
-- JSON lookup keeps this compatible with a database that has not yet added use_source_images.
create or replace function poruch_private.ingest_feed(p_city text,p_category text,p_search text,p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_city is null or p_category is null or p_offset is null or p_limit is null or char_length(p_city)>120 or char_length(p_search)>200 or p_offset<0 or p_limit not between 1 and 100 then raise exception 'invalid_feed_filters'; end if;
  return coalesce((select jsonb_agg(to_jsonb(v)) from (
    select e.id,e.title,e.starts_at,e.ends_at,e.place,e.address,e.latitude,e.longitude,e.city,e.category,e.price_from,e.currency,e.source_url,e.event_status,
      case when coalesce((to_jsonb(s)->>'use_source_images')::boolean,false) then e.cover_url else null end as cover_url,e.description,
      s.name as source_name,s.partner_params,coalesce((to_jsonb(s)->>'use_source_images')::boolean,false) as use_source_images
    from public.ingested_events e join public.event_sources s on s.id=e.source_id
    where e.status='approved' and coalesce(e.ends_at,e.starts_at)>now() and e.event_status not in ('EventCancelled','EventPostponed')
      and lower(e.city)=lower(btrim(p_city)) and (p_category='all' or e.category=p_category)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(e.title||' '||e.place||' '||e.address))>0)
    order by e.starts_at,e.id offset p_offset limit p_limit
  ) v),'[]'::jsonb);
end $$;
revoke all on function poruch_private.ingest_feed(text,text,text,integer,integer) from public;
grant execute on function poruch_private.ingest_feed(text,text,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
