# Luma & Meetup sources + "Refresh all now" — design

Feature: **event-sources** (owns `src/lib/sources/**`, `src/app/admin/sources/**`,
`src/app/api/cron/refresh-sources/**`). No shared files change.

## Goal

Admins add specific Luma calendars and Meetup groups as event sources. ORBIT pulls their
events every day, and on demand from a button on `/admin/sources`. New events are
added, changed events are updated, unchanged events are skipped, and nothing is added twice.

## Non-goals

- Crawling Luma/Meetup discovery pages ("every event in London"). That is HTML scraping,
  which both platforms' terms and `orbit-product-notes.md` §5 rule out.
- The official Luma API (needs Luma Plus) and Meetup API (needs Meetup Pro). These can be
  added later as their own source kinds.

## Data source: public iCal feeds

Both platforms publish an iCal feed for each calendar/group, so the existing iCal parser
(`ical.ts`) does the heavy lifting.

| Kind | Admin pastes | Feed ORBIT fetches |
|---|---|---|
| `meetup` | The group page, e.g. `https://www.meetup.com/london-react/` (or the feed URL itself) | `https://www.meetup.com/<urlname>/events/ical/` |
| `luma` | The calendar's **Subscribe → iCal** link from Luma (`webcal://` or `https://`, on `lu.ma` / `luma.com` / `api.lu.ma` / `api.luma.com`) | That link, with `webcal://` turned into `https://` |

Luma needs the subscribe link because a calendar page URL (`lu.ma/<slug>`) doesn't contain
the calendar ID the feed needs, and finding it would mean scraping the page. The form shows
a one-line hint on where to find the link.

During implementation, check both feed formats against a real public feed and save a
trimmed copy as a test fixture before writing the per-platform cleanup.

## Components

### `src/lib/sources/platforms.ts` (pure, tested)

- `resolveFeedUrl(kind, input): { ok: true; url: string } | { ok: false; error: string }`
  - `ical`: unchanged behaviour (any http(s) URL; `url-guard.ts` still applies at fetch time).
  - `meetup`: accepts `meetup.com/<urlname>[/…]` with or without `www.`/scheme, and returns
    the canonical feed URL. Rejects other hosts and reserved paths (`find`, `topics`, `cities`, …).
  - `luma`: accepts only the hosts above, turns `webcal:` into `https:`, and rejects a bare
    `lu.ma/<slug>` page with "Paste the calendar's Subscribe → iCal link instead."
- `cleanEvent(kind, event): NormalizedEvent`. Platform-specific tidy-up after parsing:
  - `url`: the platform's own event page (`lu.ma/…` / `meetup.com/<group>/events/<id>/`).
    If the feed has no `URL` property, take it from the description.
  - `description`: strip the platform's boilerplate footer lines (e.g. "Get up-to-date
    information at: …"), based on the saved fixtures.
  - `format`: a location that is only a platform URL means online.

### `src/lib/sources/connectors.ts`

`lumaConnector` and `meetupConnector` = fetch (`fetchFeedText`) → `parseIcal` → `cleanEvent`.
Both are registered in `CONNECTORS`. The sync engine is unchanged.

### `src/lib/sources/types.ts`

`SOURCE_KINDS = ["ical", "luma", "meetup"]`. Labels: "iCal feed", "Luma calendar", "Meetup group".

### Admin source form (`SourceForm.tsx`, `actions.ts`)

- A kind picker (iCal / Luma / Meetup), with the URL field's hint changing to match.
- `saveSource` runs `resolveFeedUrl` and stores the resolved feed URL. Invalid input returns
  the resolver's error.
- If attribution is left empty, it defaults to "From Luma" / "From Meetup".
- The permission rule is unchanged. A source can't be enabled until permission is confirmed
  and noted (e.g. "Public Meetup group feed, shown with attribution").

### Migration `supabase/migrations/20261020000000_source_platforms.sql`

Re-runnable. Drops `event_sources_kind_check` and re-adds it as `kind in ('ical', 'luma', 'meetup')`.
No other schema changes.

## "Refresh all now": same API as the cron

`src/app/api/cron/refresh-sources/route.ts` stays the single entry point:

- `GET` with `Authorization: Bearer $CRON_SECRET`: Vercel cron, unchanged (daily 03:00 UTC).
- `POST` from a **signed-in admin** (`getProfile()` + `isAdmin()`), only when the request's
  `Origin` matches the app's own host (the CSRF check that Server Actions get for free).
  The secret never reaches the browser.
- Both call `refreshAllSources()`. It gains a `trigger` option (`"cron"` | `"manual"`) so
  run history shows who started each run. `maxDuration = 300` covers both.
- Anything else → 401 (403 for a cross-origin POST).

`src/app/admin/sources/_components/RefreshAllButton.tsx` (client) sits in the page header next
to "Add source". It POSTs to the route, is disabled while the refresh runs, then shows the
summary ("3 sources · 12 new · 4 updated · 20 unchanged · 1 possible duplicate", plus any
source errors) and calls `router.refresh()`.

## Full event details in ORBIT

Imported events open on ORBIT's normal event page (`/events/[id]`), with a "Register on
Luma" / "Register on Meetup" button that links to the platform page (`registration_mode =
external`). `buildInsertRow` currently hard-codes `external_label: "View details"`; it
takes the source kind and uses "Register on Luma" / "Register on Meetup" for those kinds.

**Risk: Meetup feeds.** On 2026-10-20 a real group's `/events/ical/` returned a valid but
empty calendar, because that group had no upcoming events. Step 1 of the implementation is
to confirm against a group with upcoming events. If Meetup no longer fills these feeds,
stop and decide again before building the Meetup half.

| Detail | Where it comes from |
|---|---|
| Title, start/end, time zone, full description, venue + address, online/in-person, event link | The feed, refreshed daily |
| Cover image, price | Added by an admin (below); otherwise the existing generated cover and "price unknown" |
| Host | The source's default organiser (e.g. an ORBIT organiser profile for that community) |

**Admin "Details" editor** on `/admin/sources`, in a new "Imported events" list that shows
upcoming events from Luma/Meetup sources, with the ones missing a cover first:
- Cover upload through the existing `uploadImage("event-covers", file)` (`src/lib/storage.ts`)
  and a "Price from / to (£)" pair (empty = unknown, 0 = free).
- Saved by a `saveImportedDetails` server action (`requireAdmin`, zod) that updates only
  `cover_url`, `price_min` and `price_max`.
- The daily sync never overwrites these, because `SyncedFields` doesn't include them. A test
  in `sync-plan.test.ts` locks that in.

## Not repeating data (already in place, unchanged)

- Within a source: `unique (source, source_event_id)` on `events`, plus `planSync` diffing,
  so each run inserts new events, updates changed ones and skips unchanged ones.
- Across sources (the same event on Luma *and* Meetup): `detectDuplicates` flags pairs with
  a start within ±30 min and similar titles, for admin review in the existing queue.
- If the button and the cron overlap, the unique constraint still blocks duplicate
  rows. The later run just records the conflicts as errors.

## Errors

These go through the existing path. Fetch failures, 429/503 and parse errors are recorded on the
source and in `source_runs` and shown on `/admin/sources`. One failing source never stops the
others. Network or 5xx failures on the button show "Refresh failed: <message>".

## Tests (Vitest)

- `platforms.test.ts`: Meetup URL forms → feed URL; non-Meetup/reserved paths rejected; Luma
  `webcal`→`https`, foreign hosts and bare calendar pages rejected; `cleanEvent` against the
  saved Luma and Meetup fixtures (URL, description footer, online detection).
- Route access: the auth decision lives in a small pure helper (`refresh-auth.ts`) that takes
  the header, origin and profile and is tested for cron secret OK, admin same-origin OK,
  admin cross-origin refused, non-admin refused, and anonymous refused.
- Existing `ical`, `sync-plan` and `duplicates` tests keep passing. Then `npm test && npm run lint && npm run build`.
