# City selection and test events — 2026-10-24

The city catalogue remains the same 24 oblast centres in `src/lib/cities.ts`. Smaller cities are intentionally excluded per the user's final instruction. Existing profile city strings remain compatible. Stable identifiers come from KATOTTG (2026-07-07); coordinates are the existing application coordinates.

`DiscoveryCityProvider` supplies a shared selection inside the platform. `DiscoveryCityPicker` in TopBar provides searchable Ukrainian/Russian names and a native city select on mobile and desktop. A choice is stored as `poruch:discovery-city`; if storage is unavailable it still works for the current session. Without a saved choice, the profile city is used, then Chernihiv. Browsing another city does not edit the profile.

Home requests `events_nearby` with the selected city centre, then applies the existing radius and eligibility filters. It no longer lets device GPS override an explicit city choice. The map and creation map use the selected centre; the explicit device-location button in Create Event remains available. Stale responses cannot replace a newer city's results.

Each city has exactly two deterministic frontend examples: one personal coffee meeting and one public walk (48 total). They appear with `Тестова подія`, open details using stable demo routes, show zero real participants and use no real identity. Dates and locations are explicitly hypothetical. Demo routes perform no event, membership or chat writes; the detail action offers creation of a real event of the same type. Real events keep their normal join/chat behavior and appear before the examples. Search/category filters also apply to examples. Backend errors remain visible.

No production database records, schema, authentication settings or SVOYA objects are changed. The examples are displayed by the application, not seeded into the shared production database.

Validation: `npm test` covers all 24 city pairs, deep links, selection inside Home, persistent choice, both feeds, map centre, demo details, no fake-profile or membership actions, and stale responses. `npm run build` checks TypeScript and the production/PWA bundle. CI repeats tests/build on Node 24.

City changes render both demo feeds and the map immediately, before any discovery or membership request completes. Real results are loaded in the background with a city-specific loading status; old-city responses remain guarded. Feed scroll positions reset for the newly selected city. Regression coverage holds server responses pending while changing cities in both feed and map views.
