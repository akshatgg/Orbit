# Discovery sources research — Meetup search & Luma city pages

Date: 2026-10-20 (updated 2026-10-21)
Status: **implemented and live-tested locally** on `feat/discovery-sources`.

## TL;DR

- **Luma city pages are viable and allowed.** A city page resolves to a public iCal feed
  (`api.lu.ma/ics/get?entity=discover&id=discplace-…`). London returned 50 events, Bengaluru 19,
  all with `GEO` and `LOCATION`. Luma's robots file only disallows `/insights/` on the API host.
- **Meetup find pages are technically viable, but robots-disallowed as automated crawling.**
  Robots.txt explicitly disallows `/*?source=*` and `/*?categoryId=*` — exactly the URL patterns
  requested (`?source=EVENTS`, `&categoryId=652`). The page also needs Meetup's internal
  `/gql2` GraphQL endpoint for pagination, which is not a public API.
- **Decision (2026-10-21):** the product owner chose to build both, accepting the Meetup
  robots/ToS risk. The Meetup source is opt-in, capped at 6 pages / 250 events per run, polite,
  and easy to disable. Luma is the safer source.

## Implementation update (2026-10-21)

- New kinds: **`luma-discover`** (label “Luma link”) and **`meetup-search`** (label “Meetup
  link”). Both accept a **single event link** or a **city/search link**.
- Luma city: city page → `discplace-…` iCal feed; city timezone used for parsing.
- Meetup: find page → `/gql2` pagination; single event link → JSON-LD event page.
- Live local end-to-end run passed:
  - Luma Bengaluru city: **20 events**, all with `GEO`/`LOCATION`, timezone `Asia/Kolkata`.
  - Meetup Bengaluru search: **253 events** (across runs), re-run inserted **0** duplicates.
  - Single Meetup event: Codurance, 3 Sutton Lane, lat/lng, `Europe/London`.
  - Single Luma event: Vancouver DWeb Social, venue/address/city, lat/lng, `America/Vancouver`.
- Duplicate handling: the same event URL or platform event id (within 6 hours) is auto-hidden;
  only title/time-only matches go to the review queue.
- Known follow-up: the event page still renders times in **UK time**; the per-event timezone
  display task is not part of this implementation yet.

## Test method

Live requests on 2026-10-20, with a desktop browser User-Agent, no cookies or login:

- Fetch the find/city page, read the embedded `__NEXT_DATA__`.
- For Meetup, call `https://www.meetup.com/gql2` with the page's own
  `recommendedEventsWithSeries` query and `after` cursor.
- For Luma, resolve the `discplace-…` id and fetch the public iCal feed.
- Polite 1 s gaps between GraphQL pages. No writes.

## Meetup results

### Page shape

`find/?location=in--Bengaluru&source=EVENTS` returns a Next.js page with
`props.pageProps.__APOLLO_STATE__.ROOT_QUERY["recommendedEvents:{…}"]`. The key contains the
search arguments (`lat`, `lon`, `startDateRange`, `indexAlias`, sometimes `topicCategoryId`) and
the connection has `pageInfo`, `totalCount` and `edges`.

The first HTML page carries the first ~11 events and an end cursor. The rest are available from
`/gql2` with the same query and `after` cursor.

### Live results

| Source | Pages | Unique events | Duplicates | `hasNextPage` at stop |
|---|---|---|---|---|
| Bengaluru (no category) | 6 | **253** | 0 | false |
| Bengaluru, `categoryId=652` | 1 | **36** | 0 | false |
| London (no category) | 6 (stopped at cap) | **291** | 1 | **true** |

Important: `totalCount` is **not a stable total**. It changed per page (49, 49, 50, 50, 50, 5 on
Bengaluru). Pagination must use `pageInfo.hasNextPage` and `pageInfo.endCursor`, not
`totalCount`. London still had more pages when we stopped; a per-run cap and de-duplication are
required.

### Fields available per event

Present:

- `id`, `title`, `dateTime` (ISO with offset), `description`, `eventType`
  (`PHYSICAL` / `ONLINE` / `HYBRID`), `eventUrl`
- `featuredEventPhoto.highResUrl`
- `feeSettings` (`accepts`, `currency`, `amount`) when the organiser charges
- `group.name`, `group.urlname`, `group.timezone`
- `venue.name`, `venue.address`, `venue.city`, `venue.state`, `venue.country`

Missing:

- **End time** — Meetup's GraphQL payload and JSON-LD leave `endDate` empty for the samples.
- **Latitude/longitude** — the page's app state has them, but not the search payload. The
  existing one-page-per-event reader can fill them (25/run).
- **Cancelled/sold-out status** — not in the search payload.
- **Cover** — image URLs are meetupstatic links; they would need the same Cloudinary copy step
  used for Luma if we want to own them.

Quality from the London sample:

- 235 physical, 52 online, 4 hybrid.
- 6/291 missing a venue name; 2/291 missing a description.
- 1 duplicate event id across pages.
- Descriptions up to 6,085 characters; `LIMITS.description` already caps at 5,000.

### Robots / terms — the blocker

`https://www.meetup.com/robots.txt` includes:

```
Disallow: /*?source=*
Disallow: /*&source=*
Disallow: /*?categoryId=*
Disallow: /*&categoryId=*
Disallow: /api?
Disallow: /api/
```

The requested URLs use `source=EVENTS` and `categoryId=652`. Automated fetching of those pages
is therefore against Meetup's robots directives. The `/gql2` endpoint is not listed, but it is
the internal API the page's own JavaScript uses; it is not a public or documented API and is
subject to Meetup's terms. Bypassing a disallowed page by calling its internal API is not a
compliant workaround.

**Conclusion:** do not add a nightly Meetup search crawler without written permission from
Meetup or without using their official API (Meetup Pro). The existing per-group
`/events/ical/` feeds remain allowed by robots.

## Luma results

### Page shape

`https://lu.ma/london` redirects to `https://luma.com/london`. `__NEXT_DATA__` now exposes:

```
props.pageProps.initialData.kind = "discover-place"
props.pageProps.initialData.data.place = { api_id: "discplace-…", slug: "london", timezone, event_count, … }
props.pageProps.initialData.data.events = [ … featured events … ]
```

Older responses expose `initialData.places` / `initialData.featured_place.place`; support both.

### Feed

For a `discplace-…` id:

```
https://api.lu.ma/ics/get?entity=discover&id=discplace-…
```

Live results:

| City | Page `event_count` | iCal events | `GEO` | `LOCATION` |
|---|---|---|---|---|
| London (`discplace-QCcNk3HXowOR97j`) | 52 | **50** | 50 | 50 |
| Bengaluru (`discplace-G0tGUVYwl7T17Sb`) | 19 | **19** | 19 | 19 |

The feed has `DTSTART`/`DTEND`, `SUMMARY`, `LOCATION`, `GEO`, `UID` (`evt-…@events.lu.ma`) and
the usual Luma stub `DESCRIPTION` with the event URL. It does **not** carry a timezone, so use
`place.timezone` (`Europe/London`, `Asia/Kolkata`, …) as the parser's default timezone.

`https://api.lu.ma/robots.txt` only disallows `/insights/`; city pages and the iCal feed are
allowed. Luma's existing event-page enrichment (cover, description, price) can run unchanged.

## Recommended design

### 1. `luma-discover` source kind — build now

- Admin pastes a city page: `https://lu.ma/london` or `https://luma.com/bengaluru`.
- Save the page URL on the source.
- Connector:
  1. Fetch the page (HTML).
  2. Parse `initialData.data.place.api_id` (new) or the older places list, matching the URL slug.
  3. Fetch `https://api.lu.ma/ics/get?entity=discover&id=<discplace>`.
  4. Run the existing `parseIcal` with `defaultTimezone = place.timezone`.
  5. Run the existing `cleanEvent("luma", …)` and `enrichLumaEvents` page reader.
- All events have coordinates, venue, start/end; description/cover/price fill in over time.
- Use the existing nightly refresh and “Refresh all now”.

### 2. `meetup-search` — only with permission / official API

If written permission or Pro API access exists, the scraper design is:

- Parse the find page's `__NEXT_DATA__` for `lat`, `lon`, `startDateRange`, `indexAlias`,
  `topicCategoryId` (or `categoryId`) and the first cursor.
- Call `/gql2` with the simplified `recommendedEventsWithSeries` query, `first: 50`, and
  `after` cursors until `pageInfo.hasNextPage` is false or a hard cap is hit
  (e.g. 6 pages / 250 events per source per run).
- De-duplicate by event id across pages (London produced one duplicate in 291).
- Map `PHYSICAL`/`ONLINE`/`HYBRID`, `feeSettings`, `group.timezone` and `venue`.
- Use the existing Meetup event-page reader to fill coordinates, at 25 pages per run.
- Add the source kind, migration constraint, admin option and a visible “discovery” warning.
- Never use `totalCount` for termination.

Do not implement this path until the permission question is settled.

## Open questions

1. Do we have Meetup Pro / official API access, or can we ask Meetup for permission for this
   specific use?
2. For Luma, should a source import every upcoming event in the city, or only a selected
   category/date range? The city page has categories, but the feed is the whole city.
3. If Luma city feeds can contain 50+ events, do we want a per-source cap and a review queue for
   duplicates across city feeds?
4. Should discovery imports be attributed to a default ORBIT organiser (the source's default
   organiser) or keep the original group name in the summary?
