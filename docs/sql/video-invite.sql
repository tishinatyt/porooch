-- Manual migration. Run after 024 and 20261027085654_poruch_admin_console.
-- No network/deployment is performed by this file. Only Poruch video objects.
begin;
alter table public.events
  add column if not exists video_path text,
  add column if not exists video_poster_path text,
  add column if not exists video_duration_ms integer,
  add column if not exists video_updated_at timestamptz;
alter table public.events drop constraint if exists poruch_event_video_pair;
alter table public.events add constraint poruch_event_video_pair check (
  (video_path is null and video_poster_path is null and video_duration_ms is null and video_updated_at is null)
  or (video_path is not null and video_poster_path is not null and video_duration_ms is not null and video_duration_ms between 1 and 10000
    and video_updated_at is not null
    and video_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$')
    and video_poster_path = regexp_replace(video_path, '\.(mp4|webm)$', '.jpg'))
);

-- MUST remain private: public buckets bypass object SELECT RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('event-videos','event-videos',false,8388608,array['video/mp4','video/webm','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

create or replace function poruch_private.video_readable(p_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare e public.events;
begin
  if p_name is null or p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|jpg)$' then return false; end if;
  select * into e from public.events where id::text=split_part(p_name,'/',1);
  if not found then return false; end if;
  -- Owners can inspect their staging objects; other readers only attached files.
  if auth.uid() is not null and (e.organizer_id=auth.uid() or poruch_private.is_admin()) then return true; end if;
  if p_name is distinct from e.video_path and p_name is distinct from e.video_poster_path then return false; end if;
  if e.is_public and e.join_mode='open' then return true; end if;
  -- Mirrors existing event SELECT semantics: public/approval requires auth;
  -- invitation-only requires organizer or joined membership (not a pending request).
  return auth.uid() is not null and (e.is_public or public.is_event_participant(e.id));
end $$;
create or replace function poruch_private.video_owner(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|jpg)$'
    and exists(select 1 from public.events e where e.id::text=split_part(p_name,'/',1) and e.organizer_id=auth.uid());
$$;
revoke all on function poruch_private.video_readable(text),poruch_private.video_owner(text) from public,anon,authenticated;
grant usage on schema poruch_private to anon,authenticated;
grant execute on function poruch_private.video_readable(text) to anon,authenticated;
grant execute on function poruch_private.video_owner(text) to authenticated;

drop policy if exists poruch_video_read on storage.objects;
create policy poruch_video_read on storage.objects for select to anon,authenticated
using(bucket_id='event-videos' and poruch_private.video_readable(name));
drop policy if exists poruch_video_insert on storage.objects;
create policy poruch_video_insert on storage.objects for insert to authenticated
with check(bucket_id='event-videos' and poruch_private.video_owner(name));
-- Immutable UUID uploads: no UPDATE/upsert policy. Moderation is the explicit
-- exception to owner deletion, using the existing verified admin predicate.
drop policy if exists poruch_video_delete on storage.objects;
create policy poruch_video_delete on storage.objects for delete to authenticated
using(bucket_id='event-videos' and (poruch_private.video_owner(name) or poruch_private.is_admin()));

-- Only guarded RPCs/table-owner maintenance may write the video tuple. Existing
-- event update permissions must not let a client attach another event's files.
create or replace function poruch_private.guard_video_fields() returns trigger
language plpgsql set search_path='' as $$
begin
  if ((TG_OP='INSERT' and new.video_path is not null) or
      (TG_OP='UPDATE' and row(new.video_path,new.video_poster_path,new.video_duration_ms,new.video_updated_at)
        is distinct from row(old.video_path,old.video_poster_path,old.video_duration_ms,old.video_updated_at)))
    and current_user <> pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid='public.events'::regclass)) then
    raise exception using errcode='42501',message='use_video_rpc';
  end if;
  return new;
end $$;
revoke all on function poruch_private.guard_video_fields() from public,anon,authenticated;
drop trigger if exists poruch_guard_video_fields on public.events;
create trigger poruch_guard_video_fields before insert or update on public.events for each row execute function poruch_private.guard_video_fields();

create table if not exists poruch_private.video_reports (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  reporter_id uuid not null, video_path text not null,
  reason text not null check(char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(), unique(event_id,reporter_id,video_path)
);
create table if not exists poruch_private.video_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null, actor_id uuid not null, video_path text not null,
  reason text not null, created_at timestamptz not null default now()
);
alter table poruch_private.video_reports enable row level security;
alter table poruch_private.video_audit enable row level security;
revoke all on poruch_private.video_reports,poruch_private.video_audit from public,anon,authenticated;

create or replace function poruch_private.set_event_video(p_event_id uuid,p_path text,p_poster text,p_duration_ms integer,p_expected_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
  select * into e from public.events where id=p_event_id for update;
  if auth.uid() is null or not found or e.organizer_id<>auth.uid() then raise exception using errcode='42501',message='organizer_only'; end if;
  if p_path is null or p_poster is null or p_duration_ms is null or p_duration_ms not between 1 and 10000
    or p_path !~ ('^'||p_event_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$')
    or p_poster<>regexp_replace(p_path,'\.(mp4|webm)$','.jpg') then raise exception using errcode='22023',message='invalid_video'; end if;
  if e.video_path is distinct from p_path and e.video_path is distinct from p_expected_path then raise exception using errcode='40001',message='video_changed'; end if;
  if not exists(select 1 from storage.objects where bucket_id='event-videos' and name=p_path and (metadata->>'size')::bigint between 1 and 8388608)
    or not exists(select 1 from storage.objects where bucket_id='event-videos' and name=p_poster and (metadata->>'size')::bigint between 1 and 1048576) then
    raise exception using errcode='22023',message='video_files_missing';
  end if;
  update public.events set video_path=p_path,video_poster_path=p_poster,video_duration_ms=p_duration_ms,video_updated_at=now() where id=p_event_id;
  return (select jsonb_build_object('video_path',video_path,'video_poster_path',video_poster_path,'video_duration_ms',video_duration_ms,'video_updated_at',video_updated_at) from public.events where id=p_event_id);
end $$;
create or replace function public.poruch_set_event_video(p_event_id uuid,p_path text,p_poster text,p_duration_ms integer,p_expected_path text default null) returns jsonb
language sql security invoker set search_path='' as $$ select poruch_private.set_event_video(p_event_id,p_path,p_poster,p_duration_ms,p_expected_path); $$;

create or replace function poruch_private.remove_event_video(p_event_id uuid,p_expected_path text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
  select * into e from public.events where id=p_event_id for update;
  if auth.uid() is null or not found then raise exception using errcode='42501',message='not_allowed'; end if;
  if e.organizer_id<>auth.uid() then
    if not poruch_private.is_admin() or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception using errcode='42501',message='moderator_reason_required'; end if;
  end if;
  if e.video_path is null then return; end if;
  if e.video_path is distinct from p_expected_path then raise exception using errcode='40001',message='video_changed'; end if;
  insert into poruch_private.video_audit(event_id,actor_id,video_path,reason) values(e.id,auth.uid(),e.video_path,coalesce(p_reason,''));
  update public.events set video_path=null,video_poster_path=null,video_duration_ms=null,video_updated_at=null where id=p_event_id;
end $$;
create or replace function public.poruch_remove_event_video(p_event_id uuid,p_expected_path text,p_reason text default '') returns void
language sql security invoker set search_path='' as $$ select poruch_private.remove_event_video(p_event_id,p_expected_path,p_reason); $$;

create or replace function poruch_private.report_event_video(p_event_id uuid,p_path text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500
    or not poruch_private.video_readable(p_path)
    or not exists(select 1 from public.events where id=p_event_id and video_path=p_path) then raise exception using errcode='42501',message='invalid_video_report'; end if;
  insert into poruch_private.video_reports(event_id,reporter_id,video_path,reason) values(p_event_id,auth.uid(),p_path,btrim(p_reason))
  on conflict(event_id,reporter_id,video_path) do update set reason=excluded.reason;
end $$;
create or replace function public.poruch_report_event_video(p_event_id uuid,p_path text,p_reason text) returns void
language sql security invoker set search_path='' as $$ select poruch_private.report_event_video(p_event_id,p_path,p_reason); $$;

create or replace function poruch_private.video_admin_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not poruch_private.is_admin() then raise exception using errcode='42501',message='admin_required'; end if;
  return coalesce((select jsonb_agg(row_to_json(v)) from (
    select e.id,e.title,e.video_path,e.video_poster_path,e.video_duration_ms,e.video_updated_at,
      (select count(*) from poruch_private.video_reports r where r.event_id=e.id and r.video_path=e.video_path) as report_count,
      (select jsonb_agg(r.reason) from (select reason from poruch_private.video_reports where event_id=e.id and video_path=e.video_path order by created_at desc limit 20) r) as reasons
    from public.events e where e.video_path is not null order by e.video_updated_at desc,e.id limit 100
  ) v),'[]'::jsonb);
end $$;
create or replace function public.poruch_video_admin_list() returns jsonb
language sql security invoker set search_path='' as $$ select poruch_private.video_admin_list(); $$;

revoke all on function poruch_private.set_event_video(uuid,text,text,integer,text), public.poruch_set_event_video(uuid,text,text,integer,text),
  poruch_private.remove_event_video(uuid,text,text),public.poruch_remove_event_video(uuid,text,text),
  poruch_private.report_event_video(uuid,text,text),public.poruch_report_event_video(uuid,text,text),
  poruch_private.video_admin_list(),public.poruch_video_admin_list() from public,anon,authenticated;
grant execute on function poruch_private.set_event_video(uuid,text,text,integer,text),public.poruch_set_event_video(uuid,text,text,integer,text),
  poruch_private.remove_event_video(uuid,text,text),public.poruch_remove_event_video(uuid,text,text),
  poruch_private.report_event_video(uuid,text,text),public.poruch_report_event_video(uuid,text,text),
  poruch_private.video_admin_list(),public.poruch_video_admin_list() to authenticated;
notify pgrst,'reload schema';
commit;
