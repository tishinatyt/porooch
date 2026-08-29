# porooch — Project Context

> Source of truth for product semantics and architecture. Before significant work: read this document, then verify the relevant current code and migrations.

## 1. Product

**Product name:** porooch (always lowercase).  
**Primary UI language:** Ukrainian.

porooch helps people find people nearby through common interests and turn online discovery into real-life meetings and shared events. Its core concepts are personal meetings/events, public events, nearby discovery by interests, and moving interaction from online to offline.

Event concepts are independent:

- `event_type` (`personal | public`) controls the product/card format: a person-led meeting versus a public activity/event.
- `is_public` controls discovery visibility. `false` means invitation-only and excluded from the general public feed.
- `join_mode` (`open | approval`) controls whether an eligible user joins immediately or waits for organizer approval.

Canonical access labels:

```text
is_public === false             → «За запрошенням»
is_public !== false + approval  → «За підтвердженням»
is_public !== false + open      → «Вільний вхід»
```

Never conflate private visibility with approval-based joining.

## 2. Repository and deployment

- Repository: `tishinatyt/porooch`
- Production: <https://tishinatyt.github.io/porooch/>
- Developer workspace: `C:\Users\Dell\Documents\meetnow`
- Stack: React 19, TypeScript, Vite 6, Tailwind CSS 4, Supabase, Leaflet/OpenStreetMap, and `vite-plugin-pwa`.
- Deployment: `.github/workflows/deploy.yml` uses checkout, Node 20, `npm ci`, `npm run build`, official Pages artifact upload, and Pages deployment actions. Supabase frontend values come from GitHub Actions secrets.

Vite uses `/` for development and `/porooch/` for production builds. `BrowserRouter` derives its basename from `import.meta.env.BASE_URL`; internal routes must remain basename-relative.

The app is an installable PWA. Current production manifest values are:

- `start_url: /porooch/`
- `scope: /porooch/`
- `id: /porooch/`
- standalone display, Ukrainian language, and porooch branding.

The generated service worker uses auto-update, outdated-cache cleanup, `skipWaiting`, `clientsClaim`, and an hourly online update check. Do not reintroduce demo avatars into the precache.

GitHub Pages SPA fallback uses `public/404.html` and `index.html`. The sessionStorage key is `porooch:redirect`; restoration must stay namespaced, same-origin, restricted to `/porooch/`, and compatible with standalone PWA startup. Do not restore old `/meetnow/` routing.

## 3. Supabase

**Project ref:** `pqasdmiqnlyyjwmmqeyc`. Never record keys, database passwords, access tokens, or other secrets here.

Important current tables:

- `public.users`: application profiles (not `profiles`), keyed to `auth.users`; name, age, gender, avatar, verification, city, bio, interests, and timestamps.
- `public.events`: event content, `event_type`, visibility, join mode, organizer, geography/address, timing, requirements, capacity, and status.
- `public.event_participants`: event membership and approval states (`pending`, `joined`, `left`, `rejected`) with organizer/participant roles.
- `public.event_chats`: one group chat per event.
- `public.event_chat_messages`: chat, sender, content, and creation timestamp.
- `public.event_chat_read_state`: one read position per user and event chat.

Important database behavior:

- `is_event_participant(event_id)` grants event-chat access to the organizer or joined participants; migration 008 is the hardened definition.
- `event_chat_event_id(chat_id)` resolves a chat to its event.
- `get_unread_event_chat_count()` counts accessible unread messages for `auth.uid()`.
- `get_accessible_event_chat_unread_counts()` returns per-chat unread counts for every chat accessible to `auth.uid()` in one grouped query.
- `mark_event_chat_read(chat_id, read_through)` advances only the authenticated user's accessible chat read position.
- `trg_organizer_participant` runs `add_organizer_as_participant()` after event insertion.
- `trg_create_event_chat` runs `create_event_chat()` after event insertion.

RLS must remain enabled wherever migrations currently enable it. The frontend uses only the public/publishable key and must never use service-role credentials.

## 4. Events and RLS

`CreateEvent` validates the form, derives `organizer_id` from the authenticated Supabase user, converts local date/time to ISO UTC, builds the PostGIS point, and performs:

```ts
supabase.from('events').insert(payload).select('id').single()
```

The owner-only INSERT rule is:

```sql
auth.uid() = organizer_id
```

The organizer also needs direct SELECT access to their event:

```sql
auth.uid() = organizer_id
```

This SELECT policy is required because `.select('id')` requests the inserted row back (`INSERT ... RETURNING`). In particular, a private event must be visible to its organizer during that operation.

- `012_repair_events_insert_policy.sql` explicitly restores `events_insert` for `authenticated` users with the owner check.
- `013_events_organizer_select.sql` adds `events_select_organizer` for direct owner visibility.
- Both policies have also been applied manually to the current remote Supabase project.

Never weaken the existing SELECT, INSERT, UPDATE, or DELETE RLS policies.

## 5. Event access semantics

In Create Event:

- **«Лише за запрошенням»** changes `is_public` to `false`.
- **«Після підтвердження»** changes `join_mode` to `approval`.

They are independent. A valid invitation-only event can be `is_public = false` and `join_mode = open`.

`src/lib/eventAccess.ts` provides `getEventAccessLabel(event)` and is the canonical UI mapping. It is used by Home personal/public cards, EventDetail, CreateEvent preview, and My Events cards. Keep new event surfaces on this helper.

## 6. Home UX

Relevant files are `src/pages/HomeScreen.tsx`, `src/components/home/HomeCarousel.tsx`, `HomeEventCards.tsx`, `HomeControls.tsx`, home types/demo data, `TopBar`, and responsive rules in `src/index.css`.

Mobile/tablet behavior below 1024px:

- Personal and Public are separate, independent horizontal carousels.
- Each owns its native `overflow-x` scroll position; there is no shared ref or scroll state.
- Rails use touch scrolling, momentum, CSS scroll snap, approximately 88% mobile card width, and next-card peek.
- Vertical page scrolling remains natural.

Desktop behavior at 1024px and above:

- Personal is the left vertical feed and Public is the right vertical feed.
- Each `HomeCarousel` switches to its own `overflow-y-auto` scrollport with contained overscroll.
- Section headers/actions remain outside those scrollports.
- The Home viewport uses flex/grid with `min-height: 0`; do not turn it into one giant body-scrolling event list.

Desktop section CTAs are filled purple buttons with the existing plus icon:

- Personal: `/create?type=personal`
- Public: `/create?type=public`

`CreateEvent` reads the `type` query parameter to initialize `event_type`. Personal type does **not** imply private visibility.

## 7. Event visuals / branding

Brand spelling is **porooch**. `src/components/BrandLogo.tsx` contains the reusable inline-SVG proximity/two-people symbol and lowercase wordmark.

`EventMedia` displays a valid real cover image first and falls back after a missing URL or image error. `CategoryPlaceholder` provides lightweight category-specific gradients, patterns, and existing icons for cinema, theatre, bar, sport, music, food, games, walk, art, communication, and other. It is reused by cards, EventDetail, chat/event thumbnails, and creation preview where applicable.

Do not add external image APIs, heavy raster assets, downloaded fonts, or unnecessary dependencies. Prefer existing CSS, icons, and compact inline SVG.

## 8. Messaging and unread state

Each event has one `event_chats` row; messages live in `event_chat_messages`. Chats lists accessible event conversations through `get_accessible_event_chats()`. EventChat loads messages, subscribes to inserts for its current chat, preserves date separators/new-message behavior, and cleans up subscriptions.

Unread state uses `event_chat_read_state`, keyed by `(event_chat_id, user_id)`, with `last_read_at`. The effective rule is:

```text
message.sender_id != current user
AND message.created_at > current user's last_read_at for that chat
AND the chat is accessible to that user
```

Own messages never count. Opening EventChat advances only that chat through the newest loaded timestamp. Incoming messages are marked read while the user is at the bottom; using the new-message action advances through the newest displayed message.

`UnreadMessagesProvider` performs the initial RPC count and owns one realtime channel. It refreshes on accessible `event_chat_messages` INSERTs and changes to the current user's read-state rows. Sidebar shows no badge at zero, `1–99` numerically, and `99+` above 99. Chats fetches all per-chat counts through `get_accessible_event_chat_unread_counts()` alongside the chronological chat-list RPC; unread rows receive the same numeric badge and update through the list's shared realtime channel.

`011_event_chat_read_state.sql` creates the table, RLS, RPCs, grants, and realtime publication entry. Migration 011 was manually applied to the current remote project. Remotely verified objects are `event_chat_read_state`, `get_unread_event_chat_count()`, and `mark_event_chat_read(uuid,timestamptz)`.

Keep per-user/per-chat state. Never replace it with a global `is_read` boolean on messages.

## 9. Authentication

`AuthProvider` uses Supabase Auth, restores the session with `getSession()`, follows `onAuthStateChange`, and loads the application profile from `public.users`. Google OAuth uses a redirect derived from `new URL(import.meta.env.BASE_URL, window.location.origin)`. `ProtectedRoute` shows onboarding without a session and profile completion without a `public.users` row.

Supabase Auth production Site URL is:

```text
https://tishinatyt.github.io/porooch/
```

Allowed redirects should include:

```text
http://localhost:5173/**
https://tishinatyt.github.io/porooch/**
```

Do not reintroduce old `/meetnow/` redirect paths.

## 10. Current important migrations

1. `001_initial.sql` — initial profiles and legacy activity/match/message model, PostGIS, functions, triggers, and RLS.
2. `002_seed.sql` — legacy test users/data and avatar storage setup; do not run as a production seed.
3. `003_events.sql` — events, participants, event chats/messages, spatial/chat functions, creation triggers, indexes, and base RLS.
4. `004_seed_events.sql` — historical test events plus helper/view setup; seed-bearing.
5. `005_complete_seed.sql` — expanded historical demo dataset and reporting views; seed-bearing.
6. `006_event_join_mode.sql` — `event_type`, `join_mode`, approval statuses, and participant self-service RLS/functions.
7. `007_event_approval_workflow.sql` — secure organizer review and participant leave RPCs.
8. `008_chat_hardening.sql` — organizer-aware chat access and `get_accessible_event_chats()`.
9. `009_profile_fields.sql` — city, bio, interests, constraints, and authenticated profile RLS.
10. `010_remote_schema_reconciliation.sql` — removes drifted profile policies, reconciles avatar storage, and hardens legacy message INSERT access.
11. `011_event_chat_read_state.sql` — per-user chat read state, unread/read RPCs, RLS, and realtime.
12. `012_repair_events_insert_policy.sql` — canonical authenticated owner-only event INSERT policy.
13. `013_events_organizer_select.sql` — authenticated organizer SELECT access to their own events.
14. `014_event_chat_unread_counts.sql` — one access-controlled grouped RPC for per-chat unread counts in Chats.

Never rewrite an applied migration. Add the next numbered migration when schema changes are genuinely required.

## 11. Development rules

1. Inspect existing code before implementing.
2. Never guess the database schema.
3. Never disable RLS to fix a problem.
4. Never put service-role credentials in the frontend.
5. Never expose Supabase secrets.
6. Prefer the smallest verified fix.
7. Reuse existing components, hooks, providers, and helpers.
8. Avoid dependencies unless necessary.
9. Preserve mobile behavior when changing desktop.
10. Preserve desktop behavior when changing mobile.
11. Run `npm run build` after changes.
12. If a migration is required, create a new numbered migration; never rewrite an applied migration.
13. Do not apply remote migrations automatically unless explicitly instructed.
14. Report exact files changed and database impact.
15. For Supabase errors, capture `code`, `message`, `details`, and `hint` before changing policies.
16. Do not confuse `is_public` with `join_mode`.

## 12. Current Git state / recent milestones

Relevant commits currently in history, newest first:

- `d12b43f` — Add desktop event creation buttons.
- `4dcfe05` — Fix private event access and organizer visibility.
- `9d7240c` — Add independent desktop feeds and improve card readability.
- `4d44e78` — Add porooch logo and independent Home carousels.
- `888cc4b` — Optimize mobile Home vertical density.
- `0ca5f94` — Add mobile horizontal event carousels.
- `973cd18` — Polish porooch event cards and category visuals.
- `0f61ff5` — Fix porooch PWA startup on GitHub Pages.
- `5a6f16e` — Release porooch beta with event visuals and GitHub Pages.

Use `git log --oneline` for newer milestones; update this section when an architectural/product milestone lands.

## 13. Current verification checklist

### Authentication

- [ ] Production Google login completes.
- [ ] OAuth returns to `/porooch/`.
- [ ] Refreshing a direct protected route works.

### Events

- [ ] Create public/open event.
- [ ] Create public/approval event.
- [ ] Create private/invitation-only event.
- [ ] Organizer can open the private event returned after creation.
- [ ] Owner can delete only their own event.

### Home

- [ ] Personal mobile carousel scrolls independently.
- [ ] Public mobile carousel scrolls independently.
- [ ] Neither horizontal rail moves the other or the page horizontally.
- [ ] Desktop Personal/Public columns scroll independently.
- [ ] Both desktop create buttons open the correct type.

### Messaging

- [ ] A second account sends a message.
- [ ] Recipient unread badge increments in realtime.
- [ ] Own messages do not increment unread count.
- [ ] Opening one chat clears only that chat.
- [ ] Realtime message and read-state updates work without refresh.

### PWA

- [ ] Installed production app opens `/porooch/` without a blank window.
- [ ] Direct routes and refresh work.
- [ ] A deployed update is detected and activated without clearing all caches every launch.

## 14. How future AI sessions should start

**Before making significant changes to porooch:**

1. Read `docs/POROOCH_CONTEXT.md`.
2. Inspect the relevant current code.
3. Inspect the relevant migration(s).
4. Do not rely solely on old chat history.
5. Update `POROOCH_CONTEXT.md` when architecture, schema, deployment, or important product semantics change.
