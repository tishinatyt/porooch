# Локальное слияние merge-wip

Исходные ссылки: main `a62ce6d`, origin/wip-local `c9f837b`. Ветка merge-wip создана от main; выполнен обычный merge с двумя родителями. Fetch, pull, push и обращения к GitHub не выполнялись. К базе не подключались, миграции не применялись.

## Конфликты и сохранённая работа

Git выполнил автоматическое слияние без конфликтов: список разрешённых вручную конфликтов пуст. Проверены и сохранены настройки main: `vite.config.ts` base `/`, `public/CNAME` poruch.fun, `.env.production` VITE_APP_URL=https://poruch.fun/, корневой BrowserRouter, canonical/OG/robots/sitemap, OAuth через appOrigin и eventAuthRedirect. Эти файлы не заменялись старыми вариантами из wip-local.

Админка, DiscoveryCityContext, eventLinks, миграции 020–024 и 20261027085654 уже присутствуют в main и сохранены. Реальный diff от слияния в EventMap, public SVG и миграциях 003–005 — только окончания строк (проверено `git diff --ignore-space-at-eol main`). Из wip-local сохранено исключение dist из Git; CI создаёт dist при сборке и публикует артефакт. Локальная успешная сборка создаёт актуальный dist.

Добавлен общий OrganizerSection на гостевую главную и под лентой авторизованной главной. Тексты соответствуют заданию, продажа билетов помечена «Незабаром». Собственные SVG, карточки с перфорацией, локальные цветовые токены #0F4C4C/#E8A33D, Fraunces с Georgia fallback, мобильная колонка. Desktop-скролл лент сохранён, новый блок доступен ниже них.

CTA ведёт на `/create`. ProtectedRoute показывает гостю вход с Google или существующий сценарий профиля без Google. `/create` включён в строгий список разрешённых путей возврата; OAuth и завершение onboarding возвращают к форме. Внешние URL и произвольные пути по-прежнему отвергаются. Исправлено чтение BASE_URL гостевого лендинга для Node-тестов.

## Зависимости кода от миграций

| Миграции | Объекты и код |
| --- | --- |
| 001–002 | Базовые public.users и legacy activities/interests/matches/messages/ad_cards, PostGIS, avatars bucket и политики. AuthContext, Onboarding, Profile используют users/avatars. 002 содержит тестовые данные и INSERT в auth.users. |
| 003–005 | events, event_participants, event_chats, event_chat_messages, триггеры организатора/чата, events_nearby, get_event_coords; страницы событий, создания, лента и чат. 004–005 также исторические seed-данные. |
| 006–007 | event_type, join_mode, pending/rejected, review_event_join_request, leave_event; CreateEvent, useEvent, MyEvents и участие с подтверждением. |
| 008 | is_event_participant и get_accessible_event_chats; Chats и доступ к чатам. |
| 009–010 | city/bio/interests, политики профиля, Storage и legacy messages; Profile, Onboarding, PublicProfile. 010 согласует уже существующую hosted-схему. |
| 011, 014 | event_chat_read_state, get_unread_event_chat_count, mark_event_chat_read, get_accessible_event_chat_unread_counts; UnreadMessagesContext и Chats. |
| 012–013 | events_insert, events_select_organizer; CreateEvent и видимость собственных приватных событий. |
| 015 | profile_photos, bank_enabled/bank_note, ограничения и удаление avatar; ProfilePhotoGallery, CreateEvent, HomeScreen, EventDetail. |
| 016 | nullable age/gender; минимальный профиль Onboarding без выдуманных демографических данных. |
| 017 | Координаты в events_nearby; HomeScreen, DiscoveryMap, DiscoveryCityContext (контекст локален, RPC получает выбранные координаты города). |
| 018–019 | event_participant_count с правами authenticated; useEvent и счётчики участников. |
| 020 | search_path и ACL существующих RPC/триггерных функций; лента, координаты, чат. Новых frontend-полей не добавляет. |
| 021 | events_nearby/event_chat_event_id ACL, защищённый get_event_coords; HomeScreen, useEvent/EventMap. activities_nearby и events_point закрываются для клиентских ролей; текущий UI их не вызывает. |
| 022 | join_event(uuid); src/lib/eventParticipation.ts и присоединение на карточках/странице события. Обязательна для текущего RPC-присоединения. |
| 023 | enforce_google_verified и trg_enforce_google_verified, default false для users.google_verified, сверка с auth.identities; достоверный Google-бейдж профиля. |
| 024 | guard_event_update_consistency/триггер и обновлённый review_event_join_request; CreateEvent при редактировании и useEvent при одобрении заявок. Без неё отсутствуют новые серверные проверки вместимости/ожидающих заявок. |
| 20261027085654 | poruch_private, admin_audit (identity sequence, ограничения, RLS), приватные функции и public.poruch_is_admin/poruch_admin_data/poruch_admin_set_event_status; AdminContext и Admin.tsx. Без миграции админка не сможет проверять права, читать данные и отменять/восстанавливать события. |

Блок организаторов новых объектов БД не требует; использует существующую форму создания.

Важная особенность исторической цепочки: 020/021 ожидают шестипараметрическую `activities_nearby(double precision,double precision,double precision,text,integer,integer)`, тогда как 001 создаёт трёхпараметрическую. Создания шестипараметрической версии в этих файлах нет: это предпосылка hosted-схемы, а не доказанная возможность применить всю цепочку на пустую БД. SQL-инвентарь проверяет обе сигнатуры. Миграции в рамках слияния семантически не переписывались.

## check-migrations.sql

Один SELECT с UNION ALL и сортировкой возвращает `миграция | объект | есть/нет`: 421 проверка для всех 25 SQL-файлов. Генератор `scripts/generate-migration-check.mjs` работает только с локальными файлами и позволяет воспроизвести SQL.

Проверяются схемы, PostGIS, таблицы и колонки, primary/foreign/unique/check constraints, индексы, функции по полной сигнатуре, триггеры, политики, RLS, identity sequence, публикации Realtime, bucket avatars, nullable-поля 016 и default google_verified=false, search_path из 020. Для GRANT/REVOKE проверяется ожидаемое наличие/отсутствие прав по роли и привилегии, включая унаследованные PUBLIC-права; «есть» у ACL означает соответствие ожидаемому состоянию. Для PUBLIC используется aclexplode, для именованных ролей has_*_privilege. Несуществующий объект даёт «нет».

Запускать владельцем/postgres с доступом к каталогам и storage.buckets. Скрипт не содержит DDL/DML, DO, вызовов RPC приложения, NOTIFY или изменения migration history. Он не выполнялся на базе: реальные значения «есть/нет» ещё не получены. Наличие объекта не доказывает применение конкретной миграции и не сравнивает тела функций/политик или seed-данные. Поздние миграции заменяют некоторые политики/ACL: историческая проверка может закономерно вернуть «нет», например users_select из 001 после 009. Конфигурация bucket не сравнивается.

## Область воздействия и эвакуатор

Просмотрены все тексты миграций. Нет упоминаний tow_leads, функций tow/evakuator, REVOKE/GRANT ON SCHEMA public, ALL TABLES/FUNCTIONS IN SCHEMA public или ALTER DEFAULT PRIVILEGES. `FROM public` в REVOKE означает роль PUBLIC и применяется к явно указанной функции, а не ко всей схеме.

020–024 ограничены именованными функциями Poruch, public.events/event_participants/users; 023 читает auth.identities и обновляет google_verified у public.users. Админская миграция читает auth.users, public.users/events/event_participants, обновляет статус public.events и пишет только свой admin_audit; REVOKE/GRANT схемы относится к poruch_private. Прямых изменений объектов эвакуатора по текстам нет.

Вся историческая цепочка НЕ ограничена пространством poruch_private: 001–002 создают legacy-таблицы и тестовые Auth-пользователи, 002/010/015 меняют avatars/Storage-политики, 010 затрагивает legacy public.messages/public.matches. Если другие приложения разделяют public.users, avatars или эти legacy-объекты, изменения могут влиять и на них. Фактическое использование этих общих объектов другими приложениями без проверки БД установить нельзя. Схемные GRANT/REVOKE для всего public отсутствуют.

## Проверки

- npm install: успешно; lockfile не изменился. npm audit сообщил 10 уязвимостей зависимостей (3 low, 4 moderate, 3 high); автоматическое обновление зависимостей не выполнялось.
- npm test: 24/24, включая гостевой CTA → вход, возврат после onboarding к /create, OAuth allowlist, прежние тесты админки/города/изображений/ссылок.
- npm run build: TypeScript и Vite/PWA production build успешно.
- git diff --check: успешно. Доменные файлы сверены с main.
- Первые install/build ограничивались песочницей (EACCES/Access denied), повтор с разрешённым доступом успешен. Тесты используют моки, live OAuth и база не проверялись; браузерные скриншоты не снимались.
