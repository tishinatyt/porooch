-- Run through a trusted SQL connection. Every test rolls back; no production edits persist.
begin;
select set_config('test.admin_id',(select id::text from auth.users where lower(email)='dr12071980@gmail.com'),true);
select set_config('test.other_id',(select id::text from auth.users where lower(coalesce(email,''))<>'dr12071980@gmail.com' limit 1),true);
select set_config('test.event_id',(select e.id::text from public.events e where e.status='upcoming' and e.event_datetime>now() and e.max_participants >= (select count(*) from public.event_participants p where p.event_id=e.id and p.status='joined') order by e.created_at desc limit 1),true);
select set_config('test.profile_count',(select count(*)::text from public.users u join auth.users a on a.id=u.id),true);

set local role anon;
do $$ begin
  begin perform public.poruch_admin_data(); raise exception 'FAIL: anon read'; exception when insufficient_privilege then null; end;
  begin perform public.poruch_admin_set_event_status(null,'cancel','test','upcoming'); raise exception 'FAIL: anon write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.other_id'),true);
-- Forging editable/client email claims must not grant administrator access.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other_id'),'email','dr12071980@gmail.com','user_metadata',jsonb_build_object('role','admin'))::text,true);
set local role authenticated;
do $$ begin
  if public.poruch_is_admin() then raise exception 'FAIL: forged claims accepted'; end if;
  begin perform public.poruch_admin_data(); raise exception 'FAIL: user read'; exception when insufficient_privilege then null; end;
  begin perform public.poruch_admin_set_event_status(current_setting('test.event_id')::uuid,'cancel','test','upcoming'); raise exception 'FAIL: user write'; exception when insufficient_privilege then null; end;
  begin perform count(*) from poruch_private.admin_audit; raise exception 'FAIL: direct audit read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.admin_id'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_id'))::text,true);
set local role authenticated;
do $$
declare data jsonb; other_page jsonb; event_id uuid:=current_setting('test.event_id')::uuid; before_audit bigint; after_audit bigint;
begin
  if not public.poruch_is_admin() then raise exception 'FAIL: admin denied'; end if;
  data:=public.poruch_admin_data();
  if (data->>'total')::bigint<>current_setting('test.profile_count')::bigint then raise exception 'FAIL: wrong project count'; end if;
  if jsonb_array_length(data->'rows')>25 then raise exception 'FAIL: page limit'; end if;
  other_page:=public.poruch_admin_data('users','','',2);
  if exists(select 1 from jsonb_array_elements(data->'rows') a join jsonb_array_elements(other_page->'rows') b on a->>'id'=b->>'id') then raise exception 'FAIL: duplicated pages'; end if;
  data:=public.poruch_admin_data('users','dr12071980@gmail.com','',1);
  if (data->>'total')::int<>1 then raise exception 'FAIL: search'; end if;
  data:=public.poruch_admin_data('users','','Київ',1);
  if exists(select 1 from jsonb_array_elements(data->'rows') r where btrim(r->>'city')<>'Київ') then raise exception 'FAIL: city'; end if;
  data:=public.poruch_admin_data('users','%','',1);
  if (data->>'total')::int<>0 then raise exception 'FAIL: wildcard search'; end if;
  begin perform public.poruch_admin_data('users','','',0); raise exception 'FAIL: invalid page'; exception when invalid_parameter_value then null; end;
  begin perform public.poruch_admin_set_event_status(event_id,'cancel','','upcoming'); raise exception 'FAIL: empty reason'; exception when invalid_parameter_value then null; end;
  begin perform public.poruch_admin_set_event_status(event_id,'cancel','test','active'); raise exception 'FAIL: stale write'; exception when serialization_failure then null; end;
  before_audit:=(public.poruch_admin_data('audit')->>'total')::bigint;
  data:=public.poruch_admin_set_event_status(event_id,'cancel','Rollback-only admin verification','upcoming');
  if data->>'status'<>'cancelled' then raise exception 'FAIL: cancel'; end if;
  if exists(select 1 from public.events where id=event_id and status<>'cancelled') then raise exception 'FAIL: persisted status'; end if;
  data:=public.poruch_admin_set_event_status(event_id,'restore','Rollback-only restore verification','cancelled');
  if data->>'status'<>'upcoming' then raise exception 'FAIL: restore'; end if;
  after_audit:=(public.poruch_admin_data('audit')->>'total')::bigint;
  if after_audit<>before_audit+2 then raise exception 'FAIL: audit'; end if;
  begin perform count(*) from poruch_private.admin_audit; raise exception 'FAIL: admin direct table access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: anonymous and non-admin access denied; spoofed claims rejected; admin read, project scope, search, city, pagination, invalid inputs, concurrency, cancel/restore, audit verified; all changes rolled back' as verification;
