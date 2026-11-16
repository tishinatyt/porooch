-- Manual application after 20261116090000_event_ingest.sql. Existing RLS is preserved.
begin;
alter table public.event_sources add column if not exists use_source_images boolean not null default false;

-- Keep the same RPC signature and allowlist. Do not expose source configuration.
create or replace function poruch_private.ingest_feed(p_city text,p_category text,p_search text,p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_city is null or p_category is null or p_offset is null or p_limit is null or char_length(p_city)>120 or char_length(p_search)>200 or p_offset<0 or p_limit not between 1 and 100 then raise exception 'invalid_feed_filters'; end if;
  return coalesce((select jsonb_agg(to_jsonb(v)) from (
    select e.id,e.title,e.starts_at,e.ends_at,e.place,e.address,e.latitude,e.longitude,e.city,e.category,e.price_from,e.currency,e.source_url,
      case when s.use_source_images then e.cover_url else null end as cover_url,e.description,
      s.name as source_name,s.partner_params,s.use_source_images
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
