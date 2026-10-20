# Discovery sources — implementation plan

Feature: **event-sources** (owns `src/lib/sources/**`, `src/app/admin/sources/**`,
`src/app/api/cron/refresh-sources/**`). Adds two source kinds; no new npm dependencies.

Status: **implemented** on `feat/discovery-sources` — unit tests and a live local E2E run pass.
The per-event timezone display is still a follow-up (section 8).

Research and live test results:
[`docs/specs/2026-10-20-discovery-sources-research.md`](../specs/2026-10-20-discovery-sources-research.md).

## Validation status — what is tested and what is not

This plan is based on live requests, but **the feature itself is not built yet**. Do not read the
plan as “this already works in ORBIT”.

| Claim | Status |
|---|---|
| Luma city page → `discplace-…` | ✅ Live-tested: London (`discplace-QCcNk3HXowOR97j`) and Bengaluru (`discplace-G0tGUVYwl7T17Sb`) |
| Luma city iCal feed | ✅ Live-tested: London 50 events, Bengaluru 19, every event had `GEO` and `LOCATION` |
| Luma feed timezone | ✅ Confirmed absent; city page provides `Europe/London` / `Asia/Kolkata` |
| Meetup find page parsing (`__NEXT_DATA__`) | ✅ Live-tested on Bengaluru and London |
| Meetup `/gql2` query, anonymous | ✅ Live-tested, HTTP 200 without cookies |
| Meetup pagination by `endCursor` | ✅ Live-tested: Bengaluru 253 events over 6 pages; London 291 unique over 6 pages (more available) |
| Meetup category filter | ✅ Live-tested: `categoryId=652` → `topicCategoryId=652`, 36 events, 1 page |
| Meetup field mapping | ⚠️ Tested against real nodes, but the mapping code is not written or unit-tested yet |
| Meetup event-page coordinate fill | ⚠️ The existing reader works for group feeds; not yet run against search-imported events |
| Full connector inside ORBIT | ✅ Implemented; unit tests pass |
| Migration + admin source form | ✅ Implemented; migration applied locally |
| End-to-end nightly run / re-run / no duplicates in `events` | ✅ Live local E2E: Luma 20 events, Meetup 253, single links both imported; re-run inserted 0 |
| Per-event timezone display | ❌ Not implemented; current code is confirmed UK-only (follow-up) |
| 403/429/rate-limit behaviour | ❌ Not tested (only documented as a stop condition) |
| Meetup robots/ToS | ✅ Checked: find-page parameters are disallowed; accepted as a documented exception |

The implementation tasks include the missing unit tests, fixtures, and a local end-to-end run.
Until those pass, the plan is a validated design — not a guarantee that the feature works.

## Decision

The product owner has chosen to build **both** discovery source kinds:

- **`luma-discover`** — paste a Luma city page (`https://lu.ma/london`) and import that city's
  events. This is allowed by Luma's robots file and uses Luma's public iCal feed.
- **`meetup-search`** — paste a Meetup find page
  (`https://www.meetup.com/find/?location=in--Bengaluru&source=EVENTS`), paginate its internal
  GraphQL results, and import the events. Meetup's robots file disallows the `source` and
  `categoryId` query patterns, so this is an explicit, documented exception. It will be capped,
  polite, disabled by default, and easy to switch off.

This decision must be recorded in the research doc and the source form, so nobody enables it
without knowing the risk.

## Goal

An admin can add one discovery URL and ORBIT imports the matching public events, then keeps them
up to date on the existing nightly refresh and “Refresh all now”.

- Luma: city page → city iCal feed → existing iCal parser + Luma page enrichment.
- Meetup: find page → `/gql2` query pagination → normalised events → existing Meetup page
  enrichment for coordinates.

## Non-goals

- No attendee, member, RSVP or organiser-page scraping.
- No private, paid or login-only events.
- No full historical archive: upcoming events only.
- No bypassing a block, CAPTCHA or rate limit. A 403/429/503 stops page reads for the run.
- No attempt to make Meetup's ordering stable. The first N results are a snapshot; re-runs may
  differ.

## What the research proved

| Test | Result |
|---|---|
| Meetup Bengaluru, no category | 253 events over 6 GraphQL pages, 0 duplicate ids |
| Meetup Bengaluru, `categoryId=652` | 36 events, 1 page |
| Meetup London, no category | 291 unique events over 6 pages, **more available** |
| Luma London | 50 iCal events, all with `GEO` and `LOCATION` |
| Luma Bengaluru | 19 iCal events, all with `GEO` and `LOCATION` |

Meetup `totalCount` is not a stable total (it changes per page); terminate on
`pageInfo.hasNextPage`. Meetup search lacks end times and lat/lng; the existing page reader can
fill coordinates at 25 events/run.

## Timezone handling — required for India

The scraper itself is location-independent: Meetup uses the find URL's `location` coordinates
and Luma uses the city slug. Running from India (or from Vercel's `bom1` Mumbai region) does not
change which events are imported.

The **display** is the problem. `src/lib/format.ts` is hardcoded to `Europe/London`, and the
event page appends “UK time”. A 6:30 pm Bengaluru event would render as 2:00 pm. The stored
`events.timezone` is already correct (`Asia/Kolkata` for Bengaluru, from the Luma city page or
the Meetup group), so the data is ready.

Before enabling India sources for real users:

- Add an optional timezone argument to the date/time formatters and pass `event.timezone`.
- Show a timezone label (`IST`, `UK time`, …) instead of hardcoded “UK time”.
- Use the event timezone for day grouping, calendar days and discovery date buckets.
- Decide how ranking availability works for non-UK viewers: a profile timezone, the browser
  timezone, or the event timezone. This affects “you're free on Monday evening”.

This is a separate task (below) and touches shared files, so it should not be hidden inside the
discovery connector work.

## 1. Source kinds and schema

### Files

- `src/lib/sources/types.ts`
- `supabase/migrations/20261020000200_search_sources.sql` (new)

### Changes

- `SOURCE_KINDS = ["ical", "luma", "luma-discover", "meetup", "meetup-search"]`.
- Labels:
  - `luma-discover`: **Luma city**
  - `meetup-search`: **Meetup search**
- Migration re-adds `event_sources_kind_check` with all five kinds. Re-runnable.
- Apply locally with `docker exec -i supabase_db_orbit psql … -f -` (never `db:reset`).

### Tests

- `platforms.test.ts` will assert every kind has a resolver path.
- No generated type change: `kind` stays `text` with a check constraint.

### Commit

`feat(sources): add luma-discover and meetup-search kinds`

## 2. URL resolvers

### Files

- `src/lib/sources/platforms.ts`
- `src/lib/sources/platforms.test.ts`

### Changes

- `resolveFeedUrl("luma-discover", input)`:
  - Accept `lu.ma/<city>` and `luma.com/<city>`.
  - Normalise to `https://luma.com/<city>`.
  - Reject event pages (`/event/...`), `/discover`, `/ics`, `/api`, auth and reserved routes.
- `resolveFeedUrl("meetup-search", input)`:
  - Accept `meetup.com/find/?location=…` with or without `www.`/scheme.
  - `location` is optional. When it is present it pins the city; when it is absent, Meetup's
    page supplies its default coordinates in `__NEXT_DATA__` and the connector uses those.
  - Keep the rest of the query (`source`, `categoryId`, …) for the connector.
  - Reject non-find paths and non-Meetup hosts.
- `DEFAULT_ATTRIBUTION`: `luma-discover → "From Luma"`, `meetup-search → "From Meetup"`.
- `cleanEvent`: treat `luma-discover` exactly like `luma` (URL from stub, drop stub description).

### Tests

- Luma city URLs: London, Bengaluru, trailing slash, `lu.ma` and `luma.com`.
- Reject Luma event/ICS/API pages and other hosts.
- Meetup find URLs: `in--Bengaluru`, `gb--London`, category parameter, no scheme, and a find
  URL with no location (the page default is used).
- Reject Meetup group pages and other hosts.

### Commit

`feat(sources): resolve Luma city and Meetup search links`

## 3. Luma city connector

### Files

- `src/lib/sources/luma-discover.ts` (new; pure parser)
- `src/lib/sources/luma-discover.test.ts` (new)
- `src/lib/sources/connectors.ts`
- `src/lib/sources/__fixtures__/luma-discover.html` (new, trimmed)

### Page shape

New responses:

```
props.pageProps.initialData.kind === "discover-place"
props.pageProps.initialData.data.place = {
  api_id: "discplace-…", slug: "london", timezone: "Europe/London", event_count: 52, …
}
```

Older responses use `initialData.places` and `initialData.featured_place.place`. Support both.
`discplace-…` is required.

### Changes

- `parseLumaDiscoverPage(html, slug)` returns
  `{ apiId, slug, name, timezone, feedUrl } | null`.
- `feedUrl = https://api.lu.ma/ics/get?entity=discover&id=<discplace>`.
- `lumaDiscoverSlug(url)` reads the first path segment.
- Connector:
  1. Fetch the city page as HTML with the existing guarded fetch.
  2. Parse the place; use the URL slug to pick the right place when several are present.
  3. Fetch the iCal feed.
  4. `parseIcal(text, { now, defaultTimezone: place.timezone })`.
  5. `cleanEvent("luma-discover", event)`.
  6. Return the normalised events; a missing place or feed is a source error.
- Use `place.timezone` (`Europe/London`, `Asia/Kolkata`, …) because the feed has no timezone.

### Tests

- London fixture → `discplace-QCcNk3HXowOR97j`, `Europe/London`.
- Bengaluru fixture (older `featured_place` shape) → `discplace-G0tGUVYwl7T17Sb`, `Asia/Kolkata`.
- Missing/invalid place → `null`.
- Existing `luma-discover` clean-up: event URL from the stub, description null.

### Commit

`feat(sources): import Luma city calendars`

## 4. Meetup search connector

### Files

- `src/lib/sources/meetup-search.ts` (new; pure parsing + query)
- `src/lib/sources/meetup-search.test.ts` (new)
- `src/lib/sources/connectors.ts`
- `src/lib/sources/__fixtures__/meetup-find.html` (new, trimmed)
- `src/lib/sources/__fixtures__/meetup-search.json` (new, 2-event GraphQL response)

### Page + query

- Parse `__NEXT_DATA__` → `props.pageProps.__APOLLO_STATE__.ROOT_QUERY` key beginning
  `recommendedEvents:`.
- Parse the key suffix for `lat`, `lon`, `startDateRange`, `indexAlias`,
  `categoryId`/`topicCategoryId`.
- Read the first-page `pageInfo` and `hasNextPage`.
- Call `POST https://www.meetup.com/gql2` with the simplified
  `recommendedEventsWithSeries` query (`first: 50`), `after` cursor and the page's own
  arguments.
- Stop on `!hasNextPage`, a missing cursor, a hard cap, or a repeated cursor.
- Hard caps: **6 pages / 250 events per source per run**, 1 s between pages.
- Never use `totalCount` for termination.

### Mapping to `NormalizedEvent`

| Meetup field | ORBIT field |
|---|---|
| `id` | `sourceEventId = event_<id>@meetup.com` |
| `title` | `title` |
| `dateTime` | `startsAt` (ISO) |
| — | `endsAt = null` (not exposed) |
| — | `allDay = false` |
| `group.timezone` | `timezone` (fallback `Europe/London`) |
| `eventType` | `PHYSICAL → in_person`, `ONLINE → online`, `HYBRID → hybrid` |
| `venue.name` | `venueName` |
| `venue.address` | `address` |
| `venue.city` | `city` |
| `eventUrl` | `url` |
| `description` | cleaned prose, clamped to 5,000 |
| — | `latitude/longitude = null` until page enrichment |

- De-duplicate by `sourceEventId` across pages (London produced one duplicate in 291).
- `feeSettings` exists but `NormalizedEvent` has no price field; leave price to later page
  enrichment/admin editing. Do not invent a price.
- Missing venue is allowed (online events); missing title/start/url is a per-event error.

### Errors and blocking

- 403/429/503 → `FetchHttpError`, recorded on the source run; stop the connector.
- A later page failure records an error and returns the events collected so far.
- Page format changes → a clear “Meetup search format changed” error, no partial corruption.

### Tests

- Fixture find page → lat/lon, category, cursor, `hasNextPage`.
- Fixture response → 2 mapped events, physical/online/hybrid, timezone, venue, URL.
- Duplicate ids in two pages → one event.
- Cap: 7th page is not requested.
- Missing title/start/url → error, other events still mapped.
- No `__NEXT_DATA__` / no `recommendedEvents` → null.

### Commit

`feat(sources): import Meetup search results`

## 5. Sync and enrichment integration

### Files

- `src/lib/sources/connectors.ts`
- `src/lib/sources/engine.ts`
- `src/lib/sources/sync-plan.ts`
- `src/lib/sources/sync-plan.test.ts`
- `src/lib/sources/enrich-plan.ts` (only if a small helper is needed)

### Changes

- `CONNECTORS` gains both kinds.
- `EXTERNAL_LABELS`:
  - `luma-discover` → “Register on Luma”
  - `meetup-search` → “Register on Meetup”
- `SKIPPED_FIELDS`:
  - `luma-discover`: `["description"]` (feed has only the stub; page/admin owns it).
  - `meetup-search`: `["latitude", "longitude"]` (search payload has no coordinates; page
    enrichment owns them).
- Engine:
  - `luma` or `luma-discover` → `enrichLumaEvents`.
  - `meetup` or `meetup-search` → `enrichMeetupEvents`.
- Meetup search coordinates fill at the existing 25-page/run budget; Luma city descriptions,
  covers and prices fill at the existing Luma budget.
- `source_runs.enriched` already records the page-detail count.

### Tests

- `planSync` with `meetup-search` does not wipe coordinates.
- `planSync` with `luma-discover` does not overwrite an enriched description.
- `EXTERNAL_LABELS` and `SKIPPED_FIELDS` cover every kind.

### Commit

`feat(sources): enrich discovery events`

## 6. Admin UI

### Files

- `src/app/admin/sources/_components/SourceForm.tsx`
- `src/app/admin/sources/new/page.tsx`
- `src/lib/sources/queries.ts`
- `src/app/admin/sources/_components/ImportedEventRow.tsx`
- `src/app/admin/sources/actions.ts`

### Changes

- Kind picker adds **Luma city** and **Meetup search**.
- URL copy:
  - Luma city: “A city page, e.g. https://lu.ma/london. ORBIT imports that city's public
    events.”
  - Meetup search: “A find page, e.g.
    https://www.meetup.com/find/?location=in--Bengaluru&source=EVENTS. ORBIT imports the
    matching public events.”
- Attribution placeholder uses “From Luma” / “From Meetup” for both new kinds.
- Permission copy:
  - Feed/group kinds: existing permission check.
  - Discovery kinds: add a warning that they read public listing pages, that Meetup's robots
    rules disallow the find parameters, and that the source should be disabled if the platform
    asks us to stop.
- New source page subtitle: “An iCal feed, a Luma city or a Meetup search we have permission to
  use”.
- `listImportedEvents` includes `luma-discover` and `meetup-search`; the details editor works
  for them.
- `ImportedEvent.kind` widens to the four importing kinds; description editing is allowed for
  both Luma kinds and not for Meetup kinds (the feed owns Meetup descriptions).
- `IMPORTED_KINDS` in actions widens accordingly.

### Commit

`feat(admin): add discovery source options`

## 7. Docs

### Files

- `docs/specs/2026-10-20-discovery-sources-research.md`
- `docs/specs/2026-10-20-luma-meetup-sources-design.md`
- `docs/ARCHITECTURE.md` (source kinds / tables sentence, if needed)

### Changes

- Record the owner's decision to accept the Meetup robots/ToS risk, with the mitigation
  (disabled by default, capped, polite, easy to remove).
- Add the two kinds to the design doc and the feature ownership table.
- Keep the live test results in the research doc.

### Commit

`docs(sources): record discovery source design and risks`

## 8. Per-event timezone display (India readiness) — follow-up, not in this change

### Files

- `src/lib/format.ts` and tests
- `src/app/events/[id]/page.tsx`
- `src/lib/discovery/dates.ts`, `feed-display.ts` and tests
- `src/lib/ranking/index.ts` and tests (viewer timezone decision)

### Changes

- `formatEventDate(value, timeZone?)`, `formatTimeRange(start, end, timeZone?)`,
  `formatLongDate(value, timeZone?)` and `dayKey(value, timeZone?)`, defaulting to
  `Europe/London` so existing UK screens do not change.
- Event page passes `event.timezone` and renders a short zone label (`IST`, `UK time`) rather
  than hardcoded “UK time”.
- Calendar/date grouping passes the event's timezone.
- Ranking availability uses a viewer timezone (profile preference or the viewer's browser zone)
  instead of always UK time; document the choice.

### Tests

- An `Asia/Kolkata` event renders 18:30 IST, not 14:00.
- UK events keep their current output (regression guard).
- A late-evening IST event does not jump to the previous UK day in date grouping.

### Commit

`fix(events): render event times in the event's timezone`

## 9. Verification

Run:

```bash
npx vitest run src/lib/sources
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Manual, local:

1. Apply the migration.
2. Add `Luma city` → `https://lu.ma/bengaluru`, permission note, run now.
   Expect ~19 events, all with coordinates; event page shows a map.
3. Add `Meetup search` → the Bengaluru find URL, run now.
   Expect the first page(s) imported, no duplicates, and venue/city populated.
4. Run again → `0 new`, mostly unchanged; existing locations not wiped.
5. Disable the Meetup source → it disappears from the nightly refresh.

Production:

- `npx supabase db push`.
- Add the Luma source first; add Meetup only after the owner confirms the risk in writing.
- Watch `source_runs` for 403/429/503 and page-format errors.

## Acceptance criteria

- A Luma city source imports the city feed, keeps GEO/location/timezone, and enriches page
  details.
- A Meetup search source imports up to the cap, deduplicated, with title/date/description/venue.
- Re-running either source does not duplicate events or wipe enriched fields.
- Both appear in “Refresh all now”, run history and the imported-events editor.
- Follow-up: an India-located event shows its local time (for example `18:30 IST`), not a
  UK-converted time labelled “UK time”. This is not part of the discovery-source change.
- Lint, typecheck, all tests and the production build pass.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Meetup robots/ToS | Explicit owner decision; source disabled by default; permission note; easy to disable; no bypassing blocks. |
| Meetup internal API changes | Parser is isolated; clear “format changed” run error; no silent partial writes. |
| Rate limits / blocks | 1 s gaps; 6-page cap; stop on 403/429/503; existing run history surfaces it. |
| Large cities | 250-event/6-page cap per run; record that a run may not cover everything. |
| Duplicates across pages/sources | De-dupe by event id within the source; `detectDuplicates` auto-hides exact URL/platform-id matches and only sends title/time-only matches to review. |
| Missing end time / coordinates | `endsAt` null; page enrichment fills coordinates at 25/run; text location still shows. |
| Personalised ordering | Treat results as a snapshot; no assumption of completeness or stable order. |
| Luma page structure changes | Support both `initialData.data.place` and older `places`/`featured_place`; clear error. |
