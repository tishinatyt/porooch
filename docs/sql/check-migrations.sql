-- Read-only inventory of all migration-created objects and expected ACLs.
-- Run as postgres/owner to inspect all catalogs. No application functions are called.
-- Existence is NOT proof of migration application or function/policy body equivalence.
-- Historical policies/ACLs superseded by later migrations may report нет.
-- Seed rows are intentionally excluded; storage bucket configuration is not compared.
select '001_initial.sql' as "миграция", 'extension postgis' as "объект", case when coalesce((exists(select 1 from pg_extension where extname='postgis')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.users' as "объект", case when coalesce((to_regclass('public.users') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.users.users_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.users.users_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.name' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='name' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.age' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='age' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.users.users_age_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_age_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.gender' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='gender' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.users.users_gender_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_gender_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.avatar_url' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='avatar_url' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.google_verified' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='google_verified' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.users.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.ad_cards' as "объект", case when coalesce((to_regclass('public.ad_cards') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.ad_cards.ad_cards_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.ad_cards') and conname='ad_cards_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.title' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='title' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.description' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='description' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.cta_url' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='cta_url' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.image_url' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='image_url' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.ad_cards.active' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.ad_cards') and attname='active' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.activities' as "объект", case when coalesce((to_regclass('public.activities') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.user_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='user_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_user_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_user_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.type' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='type' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_type_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_type_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.description' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='description' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.looking_for_gender' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='looking_for_gender' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_looking_for_gender_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_looking_for_gender_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.age_min' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='age_min' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_age_min_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_age_min_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.age_max' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='age_max' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_age_max_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_age_max_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.when_time' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='when_time' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.location' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='location' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.lat' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='lat' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.lng' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='lng' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.geo' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='geo' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.status' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='status' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.activities.activities_status_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.activities') and conname='activities_status_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.activities.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.activities') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.interests' as "объект", case when coalesce((to_regclass('public.interests') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.interests.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.interests') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.interests.interests_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.interests') and conname='interests_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.interests.activity_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.interests') and attname='activity_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.interests.interests_activity_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.interests') and conname='interests_activity_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.interests.user_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.interests') and attname='user_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.interests.interests_user_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.interests') and conname='interests_user_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.interests.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.interests') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.interests.interests_activity_id_user_id_key' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.interests') and conname='interests_activity_id_user_id_key')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.matches' as "объект", case when coalesce((to_regclass('public.matches') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.matches.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.matches') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.matches.matches_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.matches') and conname='matches_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.matches.activity_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.matches') and attname='activity_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.matches.matches_activity_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.matches') and conname='matches_activity_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.matches.user1_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.matches') and attname='user1_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.matches.matches_user1_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.matches') and conname='matches_user1_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.matches.user2_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.matches') and attname='user2_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.matches.matches_user2_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.matches') and conname='matches_user2_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.matches.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.matches') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.matches.matches_activity_id_user1_id_user2_id_key' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.matches') and conname='matches_activity_id_user1_id_user2_id_key')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'table public.messages' as "объект", case when coalesce((to_regclass('public.messages') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.messages.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.messages') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.messages.messages_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.messages') and conname='messages_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.messages.match_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.messages') and attname='match_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.messages.messages_match_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.messages') and conname='messages_match_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.messages.sender_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.messages') and attname='sender_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'constraint public.messages.messages_sender_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.messages') and conname='messages_sender_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.messages.text' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.messages') and attname='text' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'column public.messages.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.messages') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.users' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.users') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.activities' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.activities') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.interests' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.interests') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.matches' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.matches') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.messages' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.messages') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'RLS public.ad_cards' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.ad_cards') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'function public.set_activity_geo()' as "объект", case when coalesce((to_regprocedure('public.set_activity_geo()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'function public.activities_nearby(double precision,double precision,double precision)' as "объект", case when coalesce((to_regprocedure('public.activities_nearby(double precision,double precision,double precision)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'function public.check_and_create_match()' as "объект", case when coalesce((to_regprocedure('public.check_and_create_match()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'index idx_activities_geo' as "объект", case when coalesce((to_regclass('public.idx_activities_geo') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'index idx_activities_status' as "объект", case when coalesce((to_regclass('public.idx_activities_status') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'index idx_interests_activity' as "объект", case when coalesce((to_regclass('public.idx_interests_activity') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'index idx_matches_users' as "объект", case when coalesce((to_regclass('public.idx_matches_users') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'index idx_messages_match' as "объект", case when coalesce((to_regclass('public.idx_messages_match') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.users.users_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.users') and polname='users_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.users.users_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.users') and polname='users_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.users.users_update' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.users') and polname='users_update')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.activities.activities_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.activities') and polname='activities_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.activities.activities_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.activities') and polname='activities_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.activities.activities_update' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.activities') and polname='activities_update')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.interests.interests_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.interests') and polname='interests_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.interests.interests_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.interests') and polname='interests_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.matches.matches_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.matches') and polname='matches_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.messages.messages_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.messages') and polname='messages_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.messages.messages_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.messages') and polname='messages_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'policy public.ad_cards.ad_cards_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.ad_cards') and polname='ad_cards_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'trigger public.activities.trg_activity_geo' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.activities') and tgname='trg_activity_geo' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '001_initial.sql' as "миграция", 'trigger public.interests.trg_check_match' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.interests') and tgname='trg_check_match' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '002_seed.sql' as "миграция", 'policy storage.objects.avatars_public_read' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_public_read')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '002_seed.sql' as "миграция", 'policy storage.objects.avatars_owner_upload' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_owner_upload')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '002_seed.sql' as "миграция", 'policy storage.objects.avatars_owner_update' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_owner_update')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '002_seed.sql' as "миграция", 'bucket avatars' as "объект", case when coalesce((exists(select 1 from storage.buckets where id='avatars')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'table public.events' as "объект", case when coalesce((to_regclass('public.events') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.title' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='title' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.description' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='description' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.category' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='category' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_category_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_category_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.is_public' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='is_public' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.organizer_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='organizer_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_organizer_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_organizer_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.cover_photo_url' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='cover_photo_url' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.location' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='location' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.address_text' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='address_text' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.event_datetime' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='event_datetime' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.max_participants' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='max_participants' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_max_participants_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_max_participants_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.min_age' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='min_age' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_min_age_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_min_age_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.max_age' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='max_age' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_max_age_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_max_age_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.gender_filter' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='gender_filter' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_gender_filter_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_gender_filter_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.status' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='status' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.events.events_status_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_status_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.events.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'table public.event_participants' as "объект", case when coalesce((to_regclass('public.event_participants') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.event_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='event_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_event_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_event_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.user_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='user_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_user_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_user_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.role' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='role' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_role_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_role_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.joined_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='joined_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_participants.status' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_participants') and attname='status' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_status_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_status_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_participants.event_participants_event_id_user_id_key' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_event_id_user_id_key')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'table public.event_chats' as "объект", case when coalesce((to_regclass('public.event_chats') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chats.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chats') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chats.event_chats_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chats') and conname='event_chats_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chats.event_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chats') and attname='event_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chats.event_chats_event_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chats') and conname='event_chats_event_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chats.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chats') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chats.event_chats_event_id_key' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chats') and conname='event_chats_event_id_key')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'table public.event_chat_messages' as "объект", case when coalesce((to_regclass('public.event_chat_messages') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chat_messages.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_messages') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chat_messages.event_chat_messages_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_messages') and conname='event_chat_messages_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chat_messages.event_chat_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_messages') and attname='event_chat_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chat_messages.event_chat_messages_event_chat_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_messages') and conname='event_chat_messages_event_chat_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chat_messages.sender_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_messages') and attname='sender_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chat_messages.event_chat_messages_sender_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_messages') and conname='event_chat_messages_sender_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chat_messages.content' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_messages') and attname='content' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'constraint public.event_chat_messages.event_chat_messages_content_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_messages') and conname='event_chat_messages_content_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'column public.event_chat_messages.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_messages') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'RLS public.events' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.events') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'RLS public.event_participants' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.event_participants') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'RLS public.event_chats' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.event_chats') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'RLS public.event_chat_messages' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.event_chat_messages') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.events_point(double precision,double precision)' as "объект", case when coalesce((to_regprocedure('public.events_point(double precision,double precision)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.add_organizer_as_participant()' as "объект", case when coalesce((to_regprocedure('public.add_organizer_as_participant()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.create_event_chat()' as "объект", case when coalesce((to_regprocedure('public.create_event_chat()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.is_event_participant(uuid)' as "объект", case when coalesce((to_regprocedure('public.is_event_participant(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.event_chat_event_id(uuid)' as "объект", case when coalesce((to_regprocedure('public.event_chat_event_id(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.event_participant_count(uuid)' as "объект", case when coalesce((to_regprocedure('public.event_participant_count(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.events_nearby(double precision,double precision,double precision,text)' as "объект", case when coalesce((to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'function public.get_event_coords(uuid)' as "объект", case when coalesce((to_regprocedure('public.get_event_coords(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_events_location' as "объект", case when coalesce((to_regclass('public.idx_events_location') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_events_status' as "объект", case when coalesce((to_regclass('public.idx_events_status') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_events_datetime' as "объект", case when coalesce((to_regclass('public.idx_events_datetime') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_events_organizer' as "объект", case when coalesce((to_regclass('public.idx_events_organizer') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_events_public' as "объект", case when coalesce((to_regclass('public.idx_events_public') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ep_event' as "объект", case when coalesce((to_regclass('public.idx_ep_event') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ep_user' as "объект", case when coalesce((to_regclass('public.idx_ep_user') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ep_status' as "объект", case when coalesce((to_regclass('public.idx_ep_status') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ec_event' as "объект", case when coalesce((to_regclass('public.idx_ec_event') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ecm_chat' as "объект", case when coalesce((to_regclass('public.idx_ecm_chat') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'index idx_ecm_sender' as "объект", case when coalesce((to_regclass('public.idx_ecm_sender') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.events.events_select_public' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_select_public')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.events.events_select_private' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_select_private')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.events.events_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.events.events_update' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_update')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.events.events_delete' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_delete')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_participants.ep_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_participants.ep_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_participants.ep_update_own' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_update_own')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_chats.ec_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chats') and polname='ec_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_chat_messages.ecm_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chat_messages') and polname='ecm_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'policy public.event_chat_messages.ecm_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chat_messages') and polname='ecm_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'trigger public.events.trg_organizer_participant' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.events') and tgname='trg_organizer_participant' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'trigger public.events.trg_create_event_chat' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.events') and tgname='trg_create_event_chat' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'publication supabase_realtime public.event_chat_messages' as "объект", case when coalesce((exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_chat_messages')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '003_events.sql' as "миграция", 'publication supabase_realtime public.event_participants' as "объект", case when coalesce((exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_participants')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '004_seed_events.sql' as "миграция", 'function public.get_event_coords(uuid)' as "объект", case when coalesce((to_regprocedure('public.get_event_coords(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '005_complete_seed.sql' as "миграция", 'function public.get_event_coords(uuid)' as "объект", case when coalesce((to_regprocedure('public.get_event_coords(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'column public.events.event_type' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='event_type' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'constraint public.events.events_event_type_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_event_type_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'column public.events.join_mode' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='join_mode' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'constraint public.events.events_join_mode_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_join_mode_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'constraint public.event_participants.event_participants_status_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_participants') and conname='event_participants_status_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'policy public.event_participants.ep_select' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_select')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'policy public.event_participants.ep_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '006_event_join_mode.sql' as "миграция", 'policy public.event_participants.ep_update_own' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_participants') and polname='ep_update_own')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'function public.review_event_join_request(uuid,uuid,text)' as "объект", case when coalesce((to_regprocedure('public.review_event_join_request(uuid,uuid,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'function public.leave_event(uuid)' as "объект", case when coalesce((to_regprocedure('public.leave_event(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.leave_event(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.leave_event(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.leave_event(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.leave_event(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '007_event_approval_workflow.sql' as "миграция", 'ACL function public.leave_event(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.leave_event(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'function public.is_event_participant(uuid)' as "объект", case when coalesce((to_regprocedure('public.is_event_participant(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'function public.get_accessible_event_chats()' as "объект", case when coalesce((to_regprocedure('public.get_accessible_event_chats()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.is_event_participant(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.is_event_participant(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.is_event_participant(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.is_event_participant(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.is_event_participant(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.is_event_participant(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.get_accessible_event_chats() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chats()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.get_accessible_event_chats() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chats()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '008_chat_hardening.sql' as "миграция", 'ACL function public.get_accessible_event_chats() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chats()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'column public.users.city' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='city' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'column public.users.bio' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='bio' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'column public.users.interests' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='interests' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'constraint public.users.users_city_length_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_city_length_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'constraint public.users.users_bio_length_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_bio_length_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'constraint public.users.users_interests_count_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_interests_count_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'policy public.users.users_select_authenticated' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.users') and polname='users_select_authenticated')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '009_profile_fields.sql' as "миграция", 'policy public.users.users_update_own' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.users') and polname='users_update_own')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '010_remote_schema_reconciliation.sql' as "миграция", 'policy storage.objects.avatars_public_read' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_public_read')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '010_remote_schema_reconciliation.sql' as "миграция", 'policy storage.objects.avatars_owner_upload' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_owner_upload')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '010_remote_schema_reconciliation.sql' as "миграция", 'policy storage.objects.avatars_owner_update' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_owner_update')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '010_remote_schema_reconciliation.sql' as "миграция", 'policy public.messages.Users can send messages' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.messages') and polname='Users can send messages')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '010_remote_schema_reconciliation.sql' as "миграция", 'bucket avatars' as "объект", case when coalesce((exists(select 1 from storage.buckets where id='avatars')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'table public.event_chat_read_state' as "объект", case when coalesce((to_regclass('public.event_chat_read_state') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'column public.event_chat_read_state.event_chat_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_read_state') and attname='event_chat_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'constraint public.event_chat_read_state.event_chat_read_state_event_chat_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_read_state') and conname='event_chat_read_state_event_chat_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'column public.event_chat_read_state.user_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_read_state') and attname='user_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'constraint public.event_chat_read_state.event_chat_read_state_user_id_fkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_read_state') and conname='event_chat_read_state_user_id_fkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'column public.event_chat_read_state.last_read_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.event_chat_read_state') and attname='last_read_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'constraint public.event_chat_read_state.event_chat_read_state_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.event_chat_read_state') and conname='event_chat_read_state_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'RLS public.event_chat_read_state' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.event_chat_read_state') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'function public.get_unread_event_chat_count()' as "объект", case when coalesce((to_regprocedure('public.get_unread_event_chat_count()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'function public.mark_event_chat_read(uuid,timestamptz)' as "объект", case when coalesce((to_regprocedure('public.mark_event_chat_read(uuid,timestamptz)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'index event_chat_read_state_user_id_idx' as "объект", case when coalesce((to_regclass('public.event_chat_read_state_user_id_idx') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'policy public.event_chat_read_state.Users can read their own accessible chat state' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chat_read_state') and polname='Users can read their own accessible chat state')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'policy public.event_chat_read_state.Users can create their own accessible chat state' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chat_read_state') and polname='Users can create their own accessible chat state')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'policy public.event_chat_read_state.Users can update their own accessible chat state' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.event_chat_read_state') and polname='Users can update their own accessible chat state')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon SELECT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'SELECT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon INSERT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'INSERT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon UPDATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'UPDATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon DELETE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'DELETE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon TRUNCATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'TRUNCATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon REFERENCES' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'REFERENCES') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state anon TRIGGER' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'TRIGGER') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state authenticated SELECT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'SELECT') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state authenticated INSERT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'INSERT') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL table public.event_chat_read_state authenticated UPDATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('public.event_chat_read_state') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'UPDATE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.get_unread_event_chat_count() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_unread_event_chat_count()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.get_unread_event_chat_count() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_unread_event_chat_count()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.get_unread_event_chat_count() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_unread_event_chat_count()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.mark_event_chat_read(uuid,timestamptz) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.mark_event_chat_read(uuid,timestamptz)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.mark_event_chat_read(uuid,timestamptz) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.mark_event_chat_read(uuid,timestamptz)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'ACL function public.mark_event_chat_read(uuid,timestamptz) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.mark_event_chat_read(uuid,timestamptz)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '011_event_chat_read_state.sql' as "миграция", 'publication supabase_realtime public.event_chat_read_state' as "объект", case when coalesce((exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_chat_read_state')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '012_repair_events_insert_policy.sql' as "миграция", 'RLS public.events' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('public.events') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '012_repair_events_insert_policy.sql' as "миграция", 'policy public.events.events_insert' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_insert')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '013_events_organizer_select.sql' as "миграция", 'policy public.events.events_select_organizer' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('public.events') and polname='events_select_organizer')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '014_event_chat_unread_counts.sql' as "миграция", 'function public.get_accessible_event_chat_unread_counts()' as "объект", case when coalesce((to_regprocedure('public.get_accessible_event_chat_unread_counts()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '014_event_chat_unread_counts.sql' as "миграция", 'ACL function public.get_accessible_event_chat_unread_counts() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chat_unread_counts()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '014_event_chat_unread_counts.sql' as "миграция", 'ACL function public.get_accessible_event_chat_unread_counts() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chat_unread_counts()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '014_event_chat_unread_counts.sql' as "миграция", 'ACL function public.get_accessible_event_chat_unread_counts() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_accessible_event_chat_unread_counts()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'column public.users.profile_photos' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='profile_photos' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'constraint public.users.users_profile_photos_max_six' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.users') and conname='users_profile_photos_max_six')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'column public.events.bank_enabled' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='bank_enabled' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'column public.events.bank_note' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.events') and attname='bank_note' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'constraint public.events.events_bank_personal_only' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_bank_personal_only')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'constraint public.events.events_bank_note_length' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('public.events') and conname='events_bank_note_length')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '015_profile_gallery_and_event_bank.sql' as "миграция", 'policy storage.objects.avatars_owner_delete' as "объект", case when coalesce((exists(select 1 from pg_policy where polrelid=to_regclass('storage.objects') and polname='avatars_owner_delete')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '016_anonymous_onboarding_profile_fields.sql' as "миграция", 'nullable public.users.age' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='age' and not attnotnull and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '016_anonymous_onboarding_profile_fields.sql' as "миграция", 'nullable public.users.gender' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('public.users') and attname='gender' and not attnotnull and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '017_events_nearby_coordinates.sql' as "миграция", 'function public.events_nearby(double precision,double precision,double precision,text)' as "объект", case when coalesce((to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '018_public_event_participant_counts.sql' as "миграция", 'function public.event_participant_count(uuid)' as "объект", case when coalesce((to_regprocedure('public.event_participant_count(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '018_public_event_participant_counts.sql' as "миграция", 'ACL function public.event_participant_count(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_participant_count(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '018_public_event_participant_counts.sql' as "миграция", 'ACL function public.event_participant_count(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_participant_count(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '018_public_event_participant_counts.sql' as "миграция", 'ACL function public.event_participant_count(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_participant_count(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '019_participant_count_revoke_anon.sql' as "миграция", 'ACL function public.event_participant_count(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_participant_count(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.events_nearby(double precision,double precision,double precision,text)' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.get_event_coords(uuid)' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.get_event_coords(uuid)') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.event_chat_event_id(uuid)' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.event_chat_event_id(uuid)') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.activities_nearby(double precision,double precision,double precision,text,integer,integer)' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.events_point(double precision,double precision)' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.events_point(double precision,double precision)') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.add_organizer_as_participant()' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.add_organizer_as_participant()') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'search_path public.create_event_chat()' as "объект", case when coalesce((exists(select 1 from pg_proc where oid=to_regprocedure('public.create_event_chat()') and 'search_path=pg_catalog, public'=any(proconfig))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.get_event_coords(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.get_event_coords(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.get_event_coords(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.activities_nearby(double precision,double precision,double precision,text,integer,integer) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.add_organizer_as_participant() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.add_organizer_as_participant()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.add_organizer_as_participant() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.add_organizer_as_participant()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.add_organizer_as_participant() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.add_organizer_as_participant()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.create_event_chat() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.create_event_chat()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.create_event_chat() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.create_event_chat()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '020_current_rpc_hardening.sql' as "миграция", 'ACL function public.create_event_chat() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.create_event_chat()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'function public.get_event_coords(uuid)' as "объект", case when coalesce((to_regprocedure('public.get_event_coords(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_nearby(double precision,double precision,double precision,text) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_nearby(double precision,double precision,double precision,text)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.get_event_coords(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.get_event_coords(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.get_event_coords(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.get_event_coords(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.get_event_coords(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.event_chat_event_id(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.event_chat_event_id(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.activities_nearby(double precision,double precision,double precision,text,integer,integer) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.activities_nearby(double precision,double precision,double precision,text,integer,integer) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.activities_nearby(double precision,double precision,double precision,text,integer,integer) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.activities_nearby(double precision,double precision,double precision,text,integer,integer) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.activities_nearby(double precision,double precision,double precision,text,integer,integer)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_point(double precision,double precision) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_point(double precision,double precision)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_point(double precision,double precision) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_point(double precision,double precision)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_point(double precision,double precision) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_point(double precision,double precision)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '021_rpc_acl_and_coordinate_privacy.sql' as "миграция", 'ACL function public.events_point(double precision,double precision) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.events_point(double precision,double precision)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '022_safe_event_join.sql' as "миграция", 'function public.join_event(uuid)' as "объект", case when coalesce((to_regprocedure('public.join_event(uuid)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '022_safe_event_join.sql' as "миграция", 'ACL function public.join_event(uuid) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.join_event(uuid)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '022_safe_event_join.sql' as "миграция", 'ACL function public.join_event(uuid) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.join_event(uuid)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '022_safe_event_join.sql' as "миграция", 'ACL function public.join_event(uuid) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.join_event(uuid)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '022_safe_event_join.sql' as "миграция", 'ACL function public.join_event(uuid) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.join_event(uuid)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'default public.users.google_verified=false' as "объект", case when coalesce((exists(select 1 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid=to_regclass('public.users') and a.attname='google_verified' and pg_get_expr(d.adbin,d.adrelid)='false')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'function public.enforce_google_verified()' as "объект", case when coalesce((to_regprocedure('public.enforce_google_verified()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'trigger public.users.trg_enforce_google_verified' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.users') and tgname='trg_enforce_google_verified' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'ACL function public.enforce_google_verified() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.enforce_google_verified()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'ACL function public.enforce_google_verified() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.enforce_google_verified()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '023_google_verification_integrity.sql' as "миграция", 'ACL function public.enforce_google_verified() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.enforce_google_verified()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'function public.guard_event_update_consistency()' as "объект", case when coalesce((to_regprocedure('public.guard_event_update_consistency()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'function public.review_event_join_request(uuid,uuid,text)' as "объект", case when coalesce((to_regprocedure('public.review_event_join_request(uuid,uuid,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'trigger public.events.trg_guard_event_update_consistency' as "объект", case when coalesce((exists(select 1 from pg_trigger where tgrelid=to_regclass('public.events') and tgname='trg_guard_event_update_consistency' and not tgisinternal)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.guard_event_update_consistency() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.guard_event_update_consistency()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.guard_event_update_consistency() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.guard_event_update_consistency()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.guard_event_update_consistency() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.guard_event_update_consistency()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '024_event_consistency_guards.sql' as "миграция", 'ACL function public.review_event_join_request(uuid,uuid,text) service_role EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.review_event_join_request(uuid,uuid,text)') and (case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'schema poruch_private' as "объект", case when coalesce((exists(select 1 from pg_namespace where nspname='poruch_private')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'table poruch_private.admin_audit' as "объект", case when coalesce((to_regclass('poruch_private.admin_audit') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'constraint poruch_private.admin_audit.admin_audit_pkey' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('poruch_private.admin_audit') and conname='admin_audit_pkey')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'sequence poruch_private.admin_audit_id_seq' as "объект", case when coalesce((exists(select 1 from pg_sequence where seqrelid=to_regclass('poruch_private.admin_audit_id_seq'))),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.actor_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='actor_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.event_id' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='event_id' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.event_title' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='event_title' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.action' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='action' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'constraint poruch_private.admin_audit.admin_audit_action_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('poruch_private.admin_audit') and conname='admin_audit_action_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.previous_status' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='previous_status' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.next_status' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='next_status' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.reason' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='reason' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'constraint poruch_private.admin_audit.admin_audit_reason_check' as "объект", case when coalesce((exists(select 1 from pg_constraint where conrelid=to_regclass('poruch_private.admin_audit') and conname='admin_audit_reason_check')),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'column poruch_private.admin_audit.created_at' as "объект", case when coalesce((exists(select 1 from pg_attribute where attrelid=to_regclass('poruch_private.admin_audit') and attname='created_at' and attnum>0 and not attisdropped)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'RLS poruch_private.admin_audit' as "объект", case when coalesce((exists(select 1 from pg_class where oid=to_regclass('poruch_private.admin_audit') and relrowsecurity)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function poruch_private.is_admin()' as "объект", case when coalesce((to_regprocedure('poruch_private.is_admin()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function public.poruch_is_admin()' as "объект", case when coalesce((to_regprocedure('public.poruch_is_admin()') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function poruch_private.admin_data(text,text,text,integer)' as "объект", case when coalesce((to_regprocedure('poruch_private.admin_data(text,text,text,integer)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function public.poruch_admin_data(text,text,text,integer)' as "объект", case when coalesce((to_regprocedure('public.poruch_admin_data(text,text,text,integer)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function poruch_private.set_event_status(uuid,text,text,text)' as "объект", case when coalesce((to_regprocedure('poruch_private.set_event_status(uuid,text,text,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'function public.poruch_admin_set_event_status(uuid,text,text,text)' as "объект", case when coalesce((to_regprocedure('public.poruch_admin_set_event_status(uuid,text,text,text)') is not null),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private public USAGE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (exists(select 1 from aclexplode(coalesce(o.nspacl,acldefault('n',o.nspowner))) a where a.grantee=0 and a.privilege_type='USAGE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private public CREATE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (exists(select 1 from aclexplode(coalesce(o.nspacl,acldefault('n',o.nspowner))) a where a.grantee=0 and a.privilege_type='CREATE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private anon USAGE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (case when exists(select 1 from pg_roles where rolname='anon') then has_schema_privilege('anon',o.oid,'USAGE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private anon CREATE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (case when exists(select 1 from pg_roles where rolname='anon') then has_schema_privilege('anon',o.oid,'CREATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private authenticated USAGE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_schema_privilege('authenticated',o.oid,'USAGE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL schema poruch_private authenticated CREATE' as "объект", case when coalesce((exists(select 1 from pg_namespace o where o.oid=(select oid from pg_namespace where nspname='poruch_private') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_schema_privilege('authenticated',o.oid,'CREATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public SELECT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='SELECT'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public INSERT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='INSERT'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public UPDATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='UPDATE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public DELETE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='DELETE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public TRUNCATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='TRUNCATE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public REFERENCES' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='REFERENCES'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit public TRIGGER' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (exists(select 1 from aclexplode(coalesce(o.relacl,acldefault('r',o.relowner))) a where a.grantee=0 and a.privilege_type='TRIGGER'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon SELECT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'SELECT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon INSERT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'INSERT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon UPDATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'UPDATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon DELETE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'DELETE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon TRUNCATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'TRUNCATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon REFERENCES' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'REFERENCES') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit anon TRIGGER' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='anon') then has_table_privilege('anon',o.oid,'TRIGGER') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated SELECT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'SELECT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated INSERT' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'INSERT') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated UPDATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'UPDATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated DELETE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'DELETE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated TRUNCATE' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'TRUNCATE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated REFERENCES' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'REFERENCES') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL table poruch_private.admin_audit authenticated TRIGGER' as "объект", case when coalesce((exists(select 1 from pg_class o where o.oid=to_regclass('poruch_private.admin_audit') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_table_privilege('authenticated',o.oid,'TRIGGER') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.is_admin() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.is_admin()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.is_admin() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.is_admin()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.is_admin() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.is_admin()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_is_admin() public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_is_admin()') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_is_admin() anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_is_admin()') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_is_admin() authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_is_admin()') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.admin_data(text,text,text,integer) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.admin_data(text,text,text,integer)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.admin_data(text,text,text,integer) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.admin_data(text,text,text,integer)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.admin_data(text,text,text,integer) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.admin_data(text,text,text,integer)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_data(text,text,text,integer) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_data(text,text,text,integer)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_data(text,text,text,integer) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_data(text,text,text,integer)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_data(text,text,text,integer) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_data(text,text,text,integer)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.set_event_status(uuid,text,text,text) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.set_event_status(uuid,text,text,text)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.set_event_status(uuid,text,text,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.set_event_status(uuid,text,text,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function poruch_private.set_event_status(uuid,text,text,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('poruch_private.set_event_status(uuid,text,text,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_set_event_status(uuid,text,text,text) public EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_set_event_status(uuid,text,text,text)') and (exists(select 1 from aclexplode(coalesce(o.proacl,acldefault('f',o.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_set_event_status(uuid,text,text,text) anon EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_set_event_status(uuid,text,text,text)') and (case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',o.oid,'EXECUTE') else false end)=false)),false) then 'есть' else 'нет' end as "есть/нет"
union all
select '20261027085654_poruch_admin_console.sql' as "миграция", 'ACL function public.poruch_admin_set_event_status(uuid,text,text,text) authenticated EXECUTE' as "объект", case when coalesce((exists(select 1 from pg_proc o where o.oid=to_regprocedure('public.poruch_admin_set_event_status(uuid,text,text,text)') and (case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',o.oid,'EXECUTE') else false end)=true)),false) then 'есть' else 'нет' end as "есть/нет"
order by 1,2;
