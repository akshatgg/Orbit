# Eventbrite & Fatsoma sources — design

Feature: **event-sources** (owns `src/lib/sources/**`, `src/app/admin/sources/**`,
`src/app/api/cron/refresh-sources/**`). No shared files change.

## Decision record (2026-10-22)

The product owner chose to import events from Eventbrite and Fatsoma by reading the same public
JSON their own websites load, the way ORBIT already reads Luma and Meetup pages. Neither
platform offers ORBIT an approved integration for this:

- **Eventbrite**'s terms only allow automated access through its official API. Its official
  search endpoint no longer exists, and organiser listings need an OAuth token. ORBIT instead
  calls the `/api/v3/…` endpoints on `www.eventbrite.co.uk`, which the website itself uses and
  which answer without a token. `robots.txt` allows `/e/`, `/o/` and `/d/` pages and doesn't
  list these endpoints.
- **Fatsoma**'s terms (clause 5.1.6) forbid copying, storing or republishing its content.
  `robots.txt` allows everything. ORBIT reads `api.fatsoma.com/v1`, the API its website uses.

This goes against `orbit-product-notes.md` §5 ("No scraping of platforms that prohibit it").
The owner accepted the same risks as for Luma and Meetup: either platform may block ORBIT, the
data formats may change without notice, and images belong to the event organisers. To limit the
impact, requests are polite and capped (below), stop at the first sign of blocking, every event
links back to its page with a "From Eventbrite" / "From Fatsoma" credit, and each source has to
be confirmed and enabled by an admin, who can disable it at any time.

## Goal

Admins paste an Eventbrite or Fatsoma link as an event source. ORBIT imports its events every
night, and when an admin presses "Refresh all now", with the same insert / update / skip
behaviour as every other source. Each event gets its **cover image**, exact times, venue with
coordinates, price range, full description and categories (for interest tags).

## What each link imports

| Kind | Admin pastes | ORBIT reads |
|---|---|---|
| `eventbrite` | An organiser page `eventbrite.co.uk/o/<name>-<id>` | `GET /api/v3/organizers/<id>/events/?status=live&order_by=start_asc`, which lists the organiser's live event ids, following `continuation`. Then the details in batches of 50 (below). |
| | An event page `eventbrite.co.uk/e/<name>-tickets-<id>` | Details for that one id |
| | A search page `eventbrite.co.uk/d/<place>/<query>/` | The page's JSON-LD `ItemList` (40 event links, dates only), then details for those ids. Eventbrite ignores `?page=2`, so a search link imports at most 40 events. |
| `fatsoma` | An organiser page `fatsoma.com/p/<vanity>` | `GET /v1/pages?filter[vanity-name]=<vanity>` → the page id → `GET /v1/events?filter[page.id]=<id>` |
| | An event page `fatsoma.com/e/<vanity>/<name>` | `GET /v1/events?filter[vanity-name]=<vanity>` |
| | A city page `fatsoma.com/l/<country>/<city>` | The page itself, once, to read the API query it embeds (`filter[location.lat-lon]=<lat>,<lon>`; London has ~2,900 events), then `GET /v1/events` with that filter |

**Eventbrite details** come from `GET /api/v3/destination/events/?event_ids=<up to 50>&expand=image,primary_venue,ticket_availability,primary_organizer`,
the endpoint Eventbrite's own search results use. One shape for all three link types: name,
local start/end + IANA time zone (converted with `zonedTimeToUtc`), venue name + address +
coordinates, online flag, cancelled flag, series id, summary, price range, organiser name, and
`tags` (Eventbrite category, subcategory and format). It has no full description (below).

**Fatsoma events** come with `include=location,page,categories`, `filter[status]=active`,
`filter[starts-at][gte]=<now>` and `sort=starts-at`, 50 per page. Filtering on the start
leaves out months-long listings that began in the past (London has nightly shows listed from
February to June), which would otherwise use up the cap. Each event has starts/ends with
an offset, an HTML description, `price-min`/`price-max` in pence, currency, `asset-url` (cover),
health (`postponed`/`cancelled`), its venue (name, address, city, postcode, coordinates, time
zone), organiser page (name) and categories.

Both connectors stop at **250 events and 6 requests per run** (`MAX_EVENTS`, `MAX_REQUESTS`),
1 s apart, through the guarded `fetchFeedText` (SSRF check, 15 s timeout, 5 MB cap, the ORBIT
User-Agent). A failed first request fails the run. A failed later page keeps what was read and
records an error, like the Meetup search connector.

## Images

| | Eventbrite | Fatsoma |
|---|---|---|
| Field | `image.original.url` | `asset-url` |
| Host | `img.evbuc.com` (signed; any change to the query string returns 403, so it is used as given) | `cdn2.fatsoma.com` |
| Size | Full size (e.g. 2048×1024) | Full size (e.g. 2618×1473) |
| Coverage checked | 40 of 40 on a London search | 50 of 50 |

As with Meetup, the image is set as `cover_url` on import (`NormalizedEvent.imageUrl` →
`fillCovers`), so every event shows its poster straight away. The details step below then has
Cloudinary fetch it and swaps in ORBIT's own copy (`orbit/event-covers/sources/`). Only `https`
URLs on those hosts are accepted. Without Cloudinary env vars, covers stay hotlinked and the run
records one error.

## Details step (`enrich-imports.ts`)

One generic reader for both platforms, run after the sync for `eventbrite` and `fatsoma` sources.
It uses the existing `source_event_details` table, so each event is handled once, with the same
picking, retry and time rules as the Luma and Meetup readers (`pickEventsToEnrich`, 25 per source
per run, 1 s apart, the shared run deadline).

- **Eventbrite description:** the batch endpoint only has the summary, so on insert
  `description` is the summary text. The step reads `GET /api/v3/events/<id>/structured_content/`
  once and stores the event's full description (its `text` modules, HTML turned into ORBIT's
  plain text with `**bold**`, `*italic*`, lists and "label (url)" links). It only replaces a
  description that is still empty or exactly the imported summary, so an admin's edit always
  wins. `SKIPPED_FIELDS.eventbrite = ["description"]` keeps the nightly sync from undoing it.
  A 403/429/503 stops Eventbrite reads for the rest of the refresh.
- **Covers (both):** a cover still hotlinked from the platform is copied to Cloudinary, guarded by
  `.eq("cover_url", <the hotlink>)` so an admin's cover is never replaced. A failed import is
  recorded as `failed` and retried on later refreshes (at most 3 tries, 24 h apart).
- Fatsoma needs no page reads: its API already has the full description. Its only work is the
  cover copy, which Cloudinary fetches, so a block on another platform doesn't stop it.

## Prices

Both APIs return a price range, so `NormalizedEvent` gains an optional `price`
(`{ min, max, currency }`; Fatsoma's pence are divided by 100). `buildInsertRow` stores it on
new events only. Like covers, prices aren't in `SyncedFields`, so an admin's price always
survives the nightly sync.

## Other changes

- `types.ts`: `SOURCE_KINDS` gains `eventbrite` and `fatsoma`, labelled "Eventbrite link" and
  "Fatsoma link".
- `platforms.ts`: `resolveFeedUrl` accepts the link forms above, on `eventbrite.<tld>` and
  `fatsoma.com`, with or without `www.`. It stores a canonical `https://www.…` URL and rejects
  anything else with a hint. `DEFAULT_ATTRIBUTION` adds "From Eventbrite" and "From Fatsoma".
- `sync-plan.ts`: `EXTERNAL_LABELS` adds "Register on Eventbrite" and "Get tickets on Fatsoma".
- `interests.ts`: Eventbrite and Fatsoma category names map to ORBIT interests
  (event category = weight 3, subcategory = 2, format = 1).
- `cancelled`: Eventbrite `is_cancelled`, and Fatsoma `health = "cancelled"`. As with every
  source, ORBIT only flags these for review. Postponed Fatsoma events are imported as normal.
- Admin form: kind picker hints, a warning box about the platform's terms for both kinds (like
  the Meetup one), and both kinds start with "Categorise each event automatically" on.
- Admin "Imported events" editor: lists Eventbrite and Fatsoma events too. The description field
  is shown for Eventbrite only, because Fatsoma's API owns its descriptions.
- Migration `20261022000000_eventbrite_fatsoma_sources.sql`: re-adds `event_sources_kind_check`
  with the two new kinds. Re-runnable.

## Not repeating data

Unchanged: `unique (source, source_event_id)` with `planSync` within a source
(`eventbrite-<id>` / `fatsoma-<uuid>`), and `detectDuplicates` across sources. That covers, for
example, the same event on Eventbrite and on Luma.

## Tests (Vitest, against trimmed real responses in `__fixtures__/`)

- `platforms.test.ts`: every link form resolves to its canonical URL; other hosts, unknown paths
  and bare domains are rejected.
- `eventbrite.test.ts`: search page → event ids; organiser listing → ids + continuation; the
  batch response → events (UTC times from local time + zone, venue, coordinates, online, price,
  full-size image, hints, summary fallback); structured content → formatted description.
- `fatsoma.test.ts`: city page → coordinates; page lookup → id; events → events (times, pence →
  pounds, venue, image, categories, postponed/cancelled); bad rows are skipped, not thrown.
- `text.test.ts`: `htmlToProse` keeps bold, italic, headings, lists and links, and drops images and
  empty paragraphs.
- `sync-plan.test.ts`: the price is set on insert only; an Eventbrite update leaves the
  description alone.
- `enrich-plan.test.ts`: description-replacement rule (empty or still the summary only).
- Then `npm test && npm run lint && npm run build`, and a live run of both connectors against
  the sample links.
