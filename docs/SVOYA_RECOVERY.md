# SVOYA recovery — source of truth

This branch restores **the real SVOYA project in source code**, using the last verified Poruch codebase as the technical foundation.

## Verified source baseline

- Repository: `tishinatyt/porooch`
- Base branch snapshot: `audit/post-production-mobile-logic`
- Base commit: `1f74e1bffe48a726d952adc305404c1a3835c775`
- Working recovery branch: `svoya-recovery-20261006`

The base contains the real React + TypeScript + Vite + Supabase implementation for:
- auth/onboarding;
- user profiles;
- profile gallery;
- event creation/editing;
- event discovery;
- join/approval flow;
- My Events;
- event chat;
- unread message state;
- PWA / GitHub Pages routing;
- migrations and RLS.

## Original SVOYA references

- Landing: https://svoya-women-club.dr12071980.chatgpt.site/
- Club platform: https://svoya-women-club.dr12071980.chatgpt.site/club?section=event
- ChatGPT Site project id: `appgprj_6ab259e9d95c8191b36827c585f4c4ef`
- Site source version observed: `8`
- Site projection revision observed: `16`

## Confirmed product architecture

`/` is the public preview/landing.

`/club` is the actual communication platform. It uses query sections:
- `?section=feed` — Стрічка
- `?section=event` — Події
- `?section=circle` — Свої кола
- `?section=beauty` — Б’юті
- `?section=business` — Бізнес
- `?section=help` — Допомога

Existing Poruch source routes remain the implementation base for:
- `/create`
- `/event/:id`
- `/event/:id/edit`
- `/event/:id/chat`
- `/my-events`
- `/chats`
- `/profile`

## Recovery rule

Do **not** invent missing SVOYA screens.

Only implement a screen when at least one of the following exists:
1. an original screenshot/reference;
2. source code from the original implementation;
3. captured HAR/assets from the live SVOYA Site;
4. a verified Poruch feature that SVOYA explicitly inherited.

If a section is not yet verified, keep the route and shell in source code but mark its content as pending reference recovery rather than fabricating UI.

## Current verified visual references

1. Public landing screenshot supplied 2026-10-06.
2. Club feed/platform screenshot supplied 2026-10-06.

These two screens are being implemented first in React source, not as generated images.
