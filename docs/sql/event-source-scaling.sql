-- Manual application after event_ingest. No migration is run by the application.
begin;
alter table public.event_sources add column if not exists use_source_images boolean not null default false;
create or replace function poruch_private.source_url_key(p_url text) returns text
language plpgsql immutable set search_path='' as $$
declare parts text[]; query text;
begin
  parts := regexp_match(split_part(btrim(p_url),'#',1),'^https://([^/?#]+)([^?#]*)(?:\?([^#]*))?$');
  if parts is null or parts[1] ~ '@' then raise exception 'invalid_source_url'; end if;
  select string_agg(param,'&' order by split_part(param,'=',1)) into query from unnest(string_to_array(coalesce(parts[3],''),'&')) param
    where param<>'' and lower(split_part(param,'=',1)) !~ '^(utm_|gad_|gclid$|fbclid$|gbraid$|wbraid$)';
  return 'https://'||lower(regexp_replace(parts[1],':443$',''))||rtrim(parts[2],'/')||case when query is not null then '?'||query else '' end;
end $$;
create or replace function poruch_private.guard_source_url() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' and new.url=old.url then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(1760916001);
  if exists(select 1 from public.event_sources s where s.id<>new.id and poruch_private.source_url_key(s.url)=poruch_private.source_url_key(new.url)) then
    raise exception using errcode='23505',message='source_url_exists';
  end if;
  return new;
end $$;
drop trigger if exists poruch_source_url_unique on public.event_sources;
create trigger poruch_source_url_unique before insert or update of url on public.event_sources for each row execute function poruch_private.guard_source_url();
revoke all on function poruch_private.source_url_key(text),poruch_private.guard_source_url() from public,anon,authenticated;

create or replace function poruch_private.import_sources(p_rows jsonb,p_use_images boolean,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; canonical text; created integer:=0; skipped integer:=0;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'invalid_source_list'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1760916001);
  for item in select value from jsonb_array_elements(p_rows) loop
    if coalesce(char_length(btrim(item->>'city')),0) not between 1 and 120 or coalesce(char_length(btrim(item->>'section')),0) not between 1 and 200
      or char_length(item->>'url')>2000 or coalesce(item->>'default_category','') not in ('cinema','theatre','bar','sport','music','food','games','walk','art','communication','other') then raise exception 'invalid_source_row'; end if;
    canonical:=poruch_private.source_url_key(item->>'url');
    if canonical is null then raise exception 'invalid_source_url'; end if;
    if exists(select 1 from public.event_sources where poruch_private.source_url_key(url)=canonical) then skipped:=skipped+1; continue; end if;
    begin
      insert into public.event_sources(name,type,url,city,default_category,enabled,auto_publish,use_source_images)
      values(left('Karabas · '||btrim(item->>'city')||' · '||btrim(item->>'section'),200),'schema_org',canonical,btrim(item->>'city'),item->>'default_category',coalesce(p_enabled,false),false,coalesce(p_use_images,false));
      created:=created+1;
    exception when unique_violation then skipped:=skipped+1;
    end;
  end loop;
  return jsonb_build_object('created',created,'skipped',skipped);
end $$;
create or replace function public.poruch_import_sources(p_rows jsonb,p_use_images boolean default false,p_enabled boolean default true) returns jsonb
language sql security invoker set search_path='' as $$ select poruch_private.import_sources(p_rows,p_use_images,p_enabled); $$;
create or replace function poruch_private.sources_auto_publish(p_ids uuid[],p_enabled boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  if p_ids is null or cardinality(p_ids) not between 1 and 1000 or p_enabled is null then raise exception 'invalid_sources'; end if;
  update public.event_sources set auto_publish=p_enabled where id=any(p_ids); get diagnostics n=row_count; return n;
end $$;
create or replace function public.poruch_sources_auto_publish(p_ids uuid[],p_enabled boolean) returns integer
language sql security invoker set search_path='' as $$ select poruch_private.sources_auto_publish(p_ids,p_enabled); $$;

-- Keep canonical merge/alias/version logic in the existing implementation.
do $$ begin
  if to_regprocedure('poruch_private.ingest_item_core(uuid,uuid,jsonb)') is null then
    alter function poruch_private.ingest_item(uuid,uuid,jsonb) rename to ingest_item_core;
  end if;
end $$;
create or replace function poruch_private.ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare result text; item public.ingested_events; auto_enabled boolean; duplicate boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(1760916000);
  select auto_publish into auto_enabled from public.event_sources where id=p_source and enabled and run_token=p_token;
  select exists(select 1 from public.ingested_events where dedup_hash=p_item->>'dedup_hash' and not (source_keys @> array[p_source::text||':'||(p_item->>'external_id')])) into duplicate;
  result:=poruch_private.ingest_item_core(p_source,p_token,p_item);
  select * into item from public.ingested_events where source_keys @> array[p_source::text||':'||(p_item->>'external_id')];
  duplicate:=duplicate or result='duplicate' or item.source_id is distinct from p_source;
  if auto_enabled and coalesce(p_item->>'auto_publish_eligible','true')='true' and not duplicate and item.status='pending' and char_length(btrim(item.title))>=3
    and (char_length(btrim(item.place))>0 or char_length(btrim(item.address))>0) and item.starts_at>now()
    and item.event_status not in ('EventCancelled','EventPostponed') then
    update public.ingested_events set status='approved',reviewed_at=now(),reviewed_by=null,updated_at=now() where id=item.id;
  end if;
  return result;
end $$;
create or replace function public.poruch_ingest_item(p_source uuid,p_token uuid,p_item jsonb) returns text language sql security invoker set search_path='' as $$ select poruch_private.ingest_item(p_source,p_token,p_item); $$;
revoke all on function poruch_private.ingest_item_core(uuid,uuid,jsonb),poruch_private.ingest_item(uuid,uuid,jsonb),public.poruch_ingest_item(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function poruch_private.ingest_item(uuid,uuid,jsonb),public.poruch_ingest_item(uuid,uuid,jsonb) to service_role;

create or replace function poruch_private.ingest_batch(p_source uuid,p_token uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; result jsonb:='[]';
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then raise exception 'invalid_batch'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    result:=result||jsonb_build_array(jsonb_build_object('external_id',item->>'external_id','result',poruch_private.ingest_item(p_source,p_token,item)));
  end loop;
  return result;
end $$;
create or replace function public.poruch_ingest_batch(p_source uuid,p_token uuid,p_items jsonb) returns jsonb language sql security invoker set search_path='' as $$ select poruch_private.ingest_batch(p_source,p_token,p_items); $$;
revoke all on function poruch_private.ingest_batch(uuid,uuid,jsonb),public.poruch_ingest_batch(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function poruch_private.ingest_batch(uuid,uuid,jsonb),public.poruch_ingest_batch(uuid,uuid,jsonb) to service_role;

-- Known centres use the same coordinates as the existing app. New cities use approved venues
-- when no configured city centre exists; null centres stay selectable in feed-only mode.
create or replace function poruch_private.ingest_cities() returns jsonb
language sql stable security definer set search_path='' as $$
  with known(name,latitude,longitude) as (values
    ('Вінниця',49.2331,28.4682),
    ('Дніпро',48.4647,35.0462),
    ('Донецьк',48.0159,37.8029),
    ('Житомир',50.2547,28.6587),
    ('Запоріжжя',47.8388,35.1396),
    ('Івано-Франківськ',48.9226,24.7111),
    ('Київ',50.4501,30.5234),
    ('Кропивницький',48.5079,32.2623),
    ('Луганськ',48.574,39.3078),
    ('Луцьк',50.7472,25.3254),
    ('Львів',49.8397,24.0297),
    ('Миколаїв',46.975,31.9946),
    ('Одеса',46.4825,30.7233),
    ('Полтава',49.5883,34.5514),
    ('Рівне',50.6199,26.2516),
    ('Суми',50.9077,34.7981),
    ('Тернопіль',49.5535,25.5948),
    ('Ужгород',48.6208,22.2879),
    ('Харків',49.9935,36.2304),
    ('Херсон',46.6354,32.6169),
    ('Хмельницький',49.423,26.9871),
    ('Черкаси',49.4444,32.0598),
    ('Чернівці',48.2915,25.9403),
    ('Чернігів',51.493,31.2945)
  ), active as (
    select e.city,avg(e.latitude) filter (where e.longitude is not null) as latitude,avg(e.longitude) filter (where e.latitude is not null) as longitude
    from public.ingested_events e join public.event_sources s on s.id=e.source_id
    where s.enabled and e.status='approved' and coalesce(e.ends_at,e.starts_at)>now() and e.event_status not in ('EventCancelled','EventPostponed')
    group by e.city
  ) select coalesce(jsonb_agg(jsonb_build_object('name',a.city,'latitude',coalesce(k.latitude,a.latitude),'longitude',coalesce(k.longitude,a.longitude)) order by a.city),'[]'::jsonb)
  from active a left join known k on lower(k.name)=lower(a.city);
$$;
create or replace function public.poruch_ingest_cities() returns jsonb language sql stable security invoker set search_path='' as $$ select poruch_private.ingest_cities(); $$;
revoke all on function poruch_private.import_sources(jsonb,boolean,boolean),public.poruch_import_sources(jsonb,boolean,boolean),poruch_private.sources_auto_publish(uuid[],boolean),public.poruch_sources_auto_publish(uuid[],boolean) from public,anon,authenticated;
grant execute on function poruch_private.import_sources(jsonb,boolean,boolean),public.poruch_import_sources(jsonb,boolean,boolean),poruch_private.sources_auto_publish(uuid[],boolean),public.poruch_sources_auto_publish(uuid[],boolean) to authenticated;
revoke all on function poruch_private.ingest_cities(),public.poruch_ingest_cities() from public,anon,authenticated;
grant execute on function poruch_private.ingest_cities(),public.poruch_ingest_cities() to anon,authenticated;
notify pgrst,'reload schema';
commit;
