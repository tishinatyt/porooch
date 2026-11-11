-- Poruch-only administration. No changes to SVOYA or existing profile/event RLS.
create schema if not exists poruch_private;
revoke all on schema poruch_private from public, anon, authenticated;
grant usage on schema poruch_private to authenticated;

create table poruch_private.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  event_id uuid not null,
  event_title text not null,
  action text not null check (action in ('cancel', 'restore')),
  previous_status text not null,
  next_status text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table poruch_private.admin_audit enable row level security;
revoke all on poruch_private.admin_audit from public, anon, authenticated;

-- Check the authoritative, verified Auth identity on every call; never user_metadata.
create function poruch_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'dr12071980@gmail.com'
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function poruch_private.is_admin() from public, anon, authenticated;
grant execute on function poruch_private.is_admin() to authenticated;
create function public.poruch_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select poruch_private.is_admin();
$$;
revoke all on function public.poruch_is_admin() from public, anon, authenticated;
grant execute on function public.poruch_is_admin() to authenticated;

create function poruch_private.admin_data(p_section text, p_search text, p_city text, p_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := lower(btrim(coalesce(p_search, '')));
  v_city text := btrim(coalesce(p_city, ''));
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
  v_stats jsonb;
  v_cities jsonb;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501', message='admin_required'; end if;
  if p_section is null or p_section not in ('users','events','audit') or p_page is null or p_page < 1 or p_page > 100000 or char_length(v_query) > 200 or char_length(v_city) > 120 then
    raise exception using errcode='22023', message='invalid_admin_filters';
  end if;
  v_offset := (p_page - 1) * 25;
  select jsonb_build_object(
    'profiles', count(*),
    'new_week', count(*) filter (where u.created_at >= now() - interval '7 days'),
    'anonymous', count(*) filter (where a.is_anonymous),
    'events', (select count(*) from public.events),
    'upcoming_events', (select count(*) from public.events where status in ('upcoming','active') and event_datetime > now()),
    'cancelled_events', (select count(*) from public.events where status='cancelled')
  ) into v_stats from public.users u join auth.users a on a.id=u.id;
  select coalesce(jsonb_agg(city order by city), '[]'::jsonb) into v_cities from (
    select distinct btrim(city) as city from public.users where nullif(btrim(city),'') is not null
  ) cities;

  if p_section='users' then
    with filtered as materialized (
      select u.id,u.name,u.city,u.age,u.gender,u.avatar_url,u.created_at,
        a.email,a.is_anonymous,a.email_confirmed_at is not null as email_confirmed,a.last_sign_in_at,
        (select count(*) from public.events e where e.organizer_id=u.id) as event_count,
        (select count(*) from public.event_participants ep where ep.user_id=u.id and ep.role='participant' and ep.status='joined') as joined_count
      from public.users u join auth.users a on a.id=u.id
      where (v_query='' or strpos(lower(concat_ws(' ',u.name,a.email,u.city,u.id::text)),v_query)>0)
        and (v_city='' or btrim(u.city)=v_city)
    ), page as (select * from filtered order by created_at desc,id limit 25 offset v_offset)
    select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb) into v_total,v_rows;
  elsif p_section='events' then
    with filtered as materialized (
      select e.id,e.title,e.description,e.address_text,e.event_type,e.is_public,e.join_mode,e.status,
        e.event_datetime,e.created_at,e.organizer_id,u.name as organizer_name,e.max_participants,
        (select count(*) from public.event_participants ep where ep.event_id=e.id and ep.status='joined') as participant_count,
        (e.status='cancelled' and e.event_datetime>now() and (
          select aa.action='cancel' from poruch_private.admin_audit aa where aa.event_id=e.id order by aa.id desc limit 1
        )) is true as can_restore
      from public.events e left join public.users u on u.id=e.organizer_id
      where v_query='' or strpos(lower(concat_ws(' ',e.title,e.description,e.address_text,u.name,e.id::text)),v_query)>0
    ), page as (select * from filtered order by created_at desc,id limit 25 offset v_offset)
    select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb) into v_total,v_rows;
  else
    with filtered as materialized (
      select id,event_id,event_title,action,previous_status,next_status,reason,created_at
      from poruch_private.admin_audit
      where v_query='' or strpos(lower(concat_ws(' ',event_title,reason)),v_query)>0
    ), page as (select * from filtered order by id desc limit 25 offset v_offset)
    select (select count(*) from filtered),coalesce((select jsonb_agg(to_jsonb(page) order by id desc) from page),'[]'::jsonb) into v_total,v_rows;
  end if;
  return jsonb_build_object('stats',v_stats,'cities',v_cities,'rows',v_rows,'total',v_total,'page',p_page,'page_size',25);
end;
$$;
revoke all on function poruch_private.admin_data(text,text,text,integer) from public,anon,authenticated;
grant execute on function poruch_private.admin_data(text,text,text,integer) to authenticated;
create function public.poruch_admin_data(p_section text default 'users',p_search text default '',p_city text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
  select poruch_private.admin_data(p_section,p_search,p_city,p_page);
$$;
revoke all on function public.poruch_admin_data(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.poruch_admin_data(text,text,text,integer) to authenticated;

create function poruch_private.set_event_status(p_event_id uuid,p_action text,p_reason text,p_expected_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_event public.events%rowtype;
  v_previous text;
  v_next text;
  v_reason text := btrim(coalesce(p_reason,''));
  v_last poruch_private.admin_audit%rowtype;
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  if p_action is null or p_action not in ('cancel','restore') or char_length(v_reason) not between 3 and 500 then
    raise exception using errcode='22023',message='invalid_admin_action';
  end if;
  select * into v_event from public.events where id=p_event_id for update;
  if not found then raise exception using errcode='P0002',message='event_not_found'; end if;
  if p_expected_status is distinct from v_event.status then raise exception using errcode='40001',message='event_changed'; end if;
  v_previous:=v_event.status;
  if p_action='cancel' then
    if v_previous not in ('upcoming','active') then raise exception using errcode='22023',message='invalid_status_transition'; end if;
    v_next:='cancelled';
  else
    select * into v_last from poruch_private.admin_audit where event_id=p_event_id order by id desc limit 1;
    if v_previous<>'cancelled' or v_last.action is distinct from 'cancel' or v_event.event_datetime<=now() then
      raise exception using errcode='22023',message='cannot_restore_event';
    end if;
    v_next:=v_last.previous_status;
  end if;
  update public.events set status=v_next where id=p_event_id;
  insert into poruch_private.admin_audit(actor_id,event_id,event_title,action,previous_status,next_status,reason)
    values(auth.uid(),p_event_id,v_event.title,p_action,v_previous,v_next,v_reason);
  return jsonb_build_object('id',p_event_id,'status',v_next);
end;
$$;
revoke all on function poruch_private.set_event_status(uuid,text,text,text) from public,anon,authenticated;
grant execute on function poruch_private.set_event_status(uuid,text,text,text) to authenticated;
create function public.poruch_admin_set_event_status(p_event_id uuid,p_action text,p_reason text,p_expected_status text)
returns jsonb language sql security invoker set search_path='' as $$
  select poruch_private.set_event_status(p_event_id,p_action,p_reason,p_expected_status);
$$;
revoke all on function public.poruch_admin_set_event_status(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.poruch_admin_set_event_status(uuid,text,text,text) to authenticated;
