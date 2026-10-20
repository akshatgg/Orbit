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

**What a real Luma calendar feed contains** (checked 2026-10-20, `cal-7iVMZ4JmmJwQtYl`, 188 events):
`SUMMARY`, `DTSTART`/`DTEND`, `LOCATION` (full address), `GEO`, `ORGANIZER;CN="<host>"`,
`STATUS`, `UID` (`evt-…@events.lu.ma`), and a `DESCRIPTION` that is only a stub:

```
Get up-to-date information at: https://luma.com/<slug>\n\nAddress:\n…\n\nHosted by <host>
```

There is **no `URL` property, no cover image, no price and no full description**. Save a
trimmed copy of this feed as a test fixture. Do the same for Meetup once step 1 has confirmed a
non-empty feed.

Luma also offers city-wide feeds (`entity=discover&id=discplace-…`). These are out of scope
here, but a London one would fit the `luma` kind unchanged if it is confirmed later.

## Components

### `src/lib/sources/platforms.ts` (pure, tested)

- `resolveFeedUrl(kind, input): { ok: true; url: string } | { ok: false; error: string }`
  - `ical`: unchanged behaviour (any http(s) URL; `url-guard.ts` still applies at fetch time).
  - `meetup`: accepts `meetup.com/<urlname>[/…]` with or without `www.`/scheme, and returns
    the canonical feed URL. Rejects other hosts and reserved paths (`find`, `topics`, `cities`, …).
  - `luma`: accepts only the hosts above, turns `webcal:` into `https:`, and rejects a bare
    `lu.ma/<slug>` page with "Paste the calendar's Subscribe → iCal link instead."
- `cleanEvent(kind, event): NormalizedEvent`. Platform-specific tidy-up after parsing:
  - `url`: the platform's own event page (`luma.com/…` / `meetup.com/<group>/events/<id>/`).
    Luma feeds have no `URL` property, so it is taken from the "Get up-to-date information
    at:" line. Only `https` links on the platform's own hosts are accepted.
  - Luma `description`: the stub is dropped (`description = null`), and `summary` becomes
    "Hosted by <host>" (from the stub, else `ORGANIZER;CN`, capped at 200 chars).
  - Meetup `description`: kept, with platform boilerplate stripped according to its fixture.
  - `format`: a location that is only a platform URL means online.
- `OWNED_FIELDS[kind]`: the event columns a kind's feed is allowed to overwrite. For `luma` this
  excludes `description`, because the feed has none, so a description an admin pastes survives
  every sync. `planSync` gets the list from the engine and leaves other columns out of updates.
  `ical` and `meetup` keep today's behaviour (all synced fields).

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
| Title, start/end, time zone, venue + address, online/in-person, event link | The feed, refreshed daily |
| "Hosted by …" line (summary) | The feed |
| Full description | Meetup: the feed. Luma: pasted by an admin (below) |
| Cover image, price | Added by an admin (below); otherwise the existing generated cover (`EventCover`) and "price unknown" |
| Host profile | The source's default organiser (e.g. an ORBIT organiser profile for that community) |

ORBIT never reads Luma/Meetup event pages automatically. The feed doesn't link events to
their images, and fetching each page by program is the scraping both platforms' terms forbid.
The organiser owns the images, so the source's permission note should cover images too.

**Admin "Details" editor** on `/admin/sources`, in a new "Imported events" list that shows
upcoming events from Luma/Meetup sources, with the ones missing a cover first. Each row links
to the event's Luma/Meetup page so the admin can copy from it in their own browser.
- **Cover image**, either way:
  - *Paste image address*: the admin right-clicks the cover on the event page in their browser,
    copies the image address and pastes it. The server action checks it is an `https` URL,
    then has **Cloudinary fetch it** (signed server-side upload with the remote URL as `file`,
    folder `orbit/event-covers/<admin id>/`). ORBIT's own server never downloads it, and the
    stored `cover_url` is ORBIT's Cloudinary copy, not a hotlink to Luma. Without Cloudinary
    env vars this fails with "Image import needs Cloudinary".
  - *Upload a file*: the existing `uploadImage("event-covers", file)` (`src/lib/storage.ts`).
- **Description** (textarea, plain text, ≤ 5,000 chars). Most useful for Luma.
- **Price from / to (£)** (empty = unknown, 0 = free).
- Saved by a `saveImportedDetails` server action (`requireAdmin`, zod) that updates only
  `cover_url`, `description`, `price_min` and `price_max`, and only on events whose `source`
  is a Luma/Meetup source.
- The daily sync never overwrites the cover or price (they aren't in `SyncedFields`), or a Luma
  description (excluded by `OWNED_FIELDS.luma`). Tests in `sync-plan.test.ts` lock both in.

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
  saved Luma and Meetup fixtures (event URL taken from the stub, "Hosted by" summary, stub
  dropped, online detection).
- `sync-plan.test.ts`: a Luma update leaves an admin-set description, cover and price untouched.
- `saveImportedDetails` input schema: non-`https` image URLs, over-long descriptions and
  negative / reversed prices are rejected.
- Route access: the auth decision lives in a small pure helper (`refresh-auth.ts`) that takes
  the header, origin and profile and is tested for cron secret OK, admin same-origin OK,
  admin cross-origin refused, non-admin refused, and anonymous refused.
- Existing `ical`, `sync-plan` and `duplicates` tests keep passing. Then `npm test && npm run lint && npm run build`.
