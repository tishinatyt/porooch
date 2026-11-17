# Проверка SQL-разделителей — 17.11.2026

Исправлены повреждённые тела функций в пяти файлах:

- docs/sql/ingest-moderation-batch.sql
- docs/sql/ingest-queue-repair.sql
- supabase/migrations/20261117120000_ingest_moderation_batch.sql
- supabase/migrations/20261117130000_moderation_skip_diagnostics.sql
- supabase/migrations/20261117140000_ingest_queue_repair.sql

Все разделители функций в этих файлах теперь `$fn$`. Ручные SQL и соответствующие миграции идентичны. Исправления записаны редактором файлов, без генерации SQL через строки PowerShell. Причина повреждения — JavaScript String.replace: `$$` внутри строки замены трактуется как одиночный `$`. При программной сборке текста нужно использовать callback замены либо редактирование файлов.

Проверены все 45 SQL-файлов в docs/sql и supabase/migrations: 161 парный dollar-quoted блок. Новый scripts/check-sql-tags.mjs учитывает SQL-строки, идентификаторы, комментарии, параметры $1 и вложенные именованные блоки; тест ловит одиночные $, отсутствующие закрывающие и несовпадающие теги. Дополнительно исправлен неэкранированный апостроф в seed-строке Кав'ярня в 001_initial.sql.

`pg-query-parser`, `pgsql-parser`, `libpg-query`, `@pgsql/parser`, Python/pglast и psql в доступном окружении не обнаружены. Выполнен построчный просмотр всего ingest-queue-repair.sql: разделители, строковые литералы, скобки, BEGIN/END, окончания операторов, сигнатуры функций, qualified column references. Лексическая проверка не заменяет полноценный PostgreSQL/PLpgSQL-парсер; SQL в базе не выполнялся. Все 128 тестов прошли. Pull/push и подключений к базе не было.

Первые 15 строк docs/sql/ingest-queue-repair.sql:

```sql
-- Manual, repeatable. Apply after ingest-moderation-batch.sql and event-source-scaling.sql.
begin;


create or replace function poruch_private.moderation_venue(p_item jsonb) returns text
language sql immutable set search_path='' as $fn$
 select coalesce(nullif(btrim(p_item->>'place'),''),nullif(btrim(p_item->>'address'),''),
 nullif(btrim(p_item#>>'{raw_data,location,name}'),''),nullif(btrim(p_item#>>'{raw_data,venue,name}'),''),
 case when jsonb_typeof(p_item#>'{raw_data,venue}')='string' then nullif(btrim(p_item#>>'{raw_data,venue}'),'') end,
 nullif(btrim(p_item#>>'{raw_data,location,address,streetAddress}'),''),
 case when jsonb_typeof(p_item#>'{raw_data,location,address}')='string' then nullif(btrim(p_item#>>'{raw_data,location,address}'),'') end,
 case when jsonb_typeof(p_item#>'{raw_data,location}')='string' then nullif(btrim(p_item#>>'{raw_data,location}'),'') end,'');
$fn$;
create or replace function poruch_private.moderation_identity(p_item jsonb) returns text
language sql immutable set search_path='' as $fn$
```
