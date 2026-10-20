# Luma & Meetup Sources Implementation Plan

**Goal:** Admins add Luma calendars and Meetup groups as event sources; the daily cron (and a "Refresh all now" button that hits the same route) imports their events without duplicates, and reads each new Luma event's page once for cover image, full description and price, with admin paste/upload as fallback.

**Architecture:** Extends the existing `event-sources` feature (`src/lib/sources/**`). Two new source kinds reuse the iCal parser with per-platform URL resolving and cleanup. A new enrichment step reads Luma event pages' schema.org JSON-LD, records attempts in `source_event_details`, and copies covers into Cloudinary. The cron route accepts either `CRON_SECRET` (GET) or a signed-in admin (same-origin POST).

**Tech Stack:** Next.js 16 App Router (Cache Components), TypeScript, Supabase (Postgres + RLS), `ical.js`, zod 4, Vitest, Cloudinary upload API.

**Spec:** `docs/specs/2026-10-20-luma-meetup-sources-design.md`

## Global Constraints

- Only touch files owned by event-sources: `src/lib/sources/**`, `src/app/admin/sources/**`, `src/app/api/cron/refresh-sources/**`, plus the new migration `supabase/migrations/20261020000000_source_platforms.sql`. Shared files (`src/components/ui/**`, `src/lib/auth.ts`, `src/lib/cloudinary.ts`, `src/lib/storage.ts`, `src/types/*`, `package.json`, existing migrations) are read-only.
- No new npm dependencies.
- Never edit existing migrations. Apply locally with `docker exec -i supabase_db_orbit psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261020000000_source_platforms.sql`. **Never run `npm run db:reset` or stop Supabase.**
- Commits: Conventional Commits, author `Akshat <akshatg9536@gmail.com>`, **no AI/assistant attribution anywhere** (commits, code, comments). Commit with `git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "…"`.
- Server-only modules start with `import "server-only";`. Pure modules (tested) must not import server-only modules.
- Luma page reads: only `https` URLs on `luma.com` / `lu.ma`, only events whose `source_event_id` starts with `evt-`, max 25 per source per run, 1 s apart, stop on HTTP 403/429/503, 120 s budget per source, only fill empty fields.
- Run tests with `npx vitest run <file>`; full gate `npm test && npm run lint && npm run build`.
- Work on branch `feat/luma-meetup-sources` (already created, spec and fixtures committed there).

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261020000000_source_platforms.sql` | create | kinds `luma`/`meetup`, `source_event_details`, `source_runs.enriched` |
| `src/lib/sources/types.ts` | modify | kinds, labels, `enriched`, `RefreshSummary`, `SourceEventDetails` |
| `src/lib/sources/platforms.ts` (+ `.test.ts`) | create | `resolveFeedUrl`, `cleanEvent`, `lumaPageUrl`, `DEFAULT_ATTRIBUTION` |
| `src/lib/sources/__fixtures__/luma-calendar.ics`, `luma-event.html` | exist | real trimmed Luma feed + page |
| `src/lib/sources/connectors.ts` | modify | register `luma`, `meetup` |
| `src/lib/sources/sync-plan.ts` (+ test) | modify | `EXTERNAL_LABELS`, `SKIPPED_FIELDS`, `skip` option |
| `src/lib/sources/luma-page.ts` (+ test) | create | `parseLumaEventPage(html)` |
| `src/lib/sources/enrich-plan.ts` (+ test) | create | pure selection / stop / patch rules |
| `src/lib/sources/fetch.ts` | modify | `FetchHttpError`, `accept` option |
| `src/lib/sources/cloudinary-import.ts` | create | `importRemoteImage(url, folder)` |
| `src/lib/sources/enrich.ts` | create | `enrichLumaEvents` (DB + network) |
| `src/lib/sources/engine.ts` | modify | wire kinds, skip, enrichment, `trigger` |
| `src/lib/sources/refresh-auth.ts` (+ test) | create | `authoriseRefresh` |
| `src/lib/sources/refresh-summary.ts` (+ test) | create | `formatRefreshSummary` |
| `src/app/api/cron/refresh-sources/route.ts` | modify | GET cron + POST admin |
| `src/app/admin/sources/_components/RefreshAllButton.tsx` | create | button |
| `src/app/admin/sources/_components/SourceForm.tsx`, `actions.ts` | modify | kind picker, resolve URL, details actions |
| `src/lib/sources/details-schema.ts` (+ test) | create | zod schema for the details editor |
| `src/lib/sources/queries.ts` | modify | `listImportedEvents` |
| `src/app/admin/sources/_components/ImportedEventRow.tsx` | create | details editor row |
| `src/app/admin/sources/page.tsx` | modify | button, imported events section, enriched count |

---

### Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/20261020000000_source_platforms.sql`
- Modify: `src/lib/sources/types.ts`, `src/lib/sources/engine.ts` (move `RefreshSummary` type only)

**Interfaces:**
- Produces: `SOURCE_KINDS = ["ical","luma","meetup"]`, `SourceKind`, `SOURCE_KIND_LABELS`, `RunSummary.enriched: number`, `SourceRun.enriched: number`, `DetailsStatus = "ok"|"failed"|"blocked"`, `SourceEventDetails`, `RefreshSummary` (now exported from `types.ts`).

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261020000000_source_platforms.sql`:

```sql
-- Luma and Meetup source kinds, per-event page-details tracking, and an "enriched" count per run.
-- Re-runnable: safe to apply more than once.

-- ═══ Source kinds ═══════════════════════════════════════════════════════════

alter table public.event_sources drop constraint if exists event_sources_kind_check;
alter table public.event_sources
  add constraint event_sources_kind_check check (kind in ('ical', 'luma', 'meetup'));

-- ═══ Run history: how many events got page details ══════════════════════════

alter table public.source_runs add column if not exists enriched int not null default 0;

-- ═══ Page details: one row per event whose source page was read ═════════════
-- Lets the sync read each Luma event page once instead of every night.

create table if not exists public.source_event_details (
  event_id   uuid primary key references public.events (id) on delete cascade,
  status     text not null check (status in ('ok', 'failed', 'blocked')),
  attempts   int not null default 1 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 500),
  fetched_at timestamptz not null default now()
);

create index if not exists source_event_details_status_idx on public.source_event_details (status);

grant select, insert, update, delete on public.source_event_details to authenticated;
grant all on public.source_event_details to service_role;

alter table public.source_event_details enable row level security;

drop policy if exists source_event_details_admin on public.source_event_details;
create policy source_event_details_admin on public.source_event_details for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Apply it twice (proves re-runnable)**

Run:
```bash
docker exec -i supabase_db_orbit psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261020000000_source_platforms.sql
docker exec -i supabase_db_orbit psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261020000000_source_platforms.sql
docker exec supabase_db_orbit psql -U postgres -Atc "select pg_get_constraintdef(oid) from pg_constraint where conname='event_sources_kind_check'; select count(*) from information_schema.columns where table_name='source_runs' and column_name='enriched';"
```
Expected: both applies finish without `ERROR`; output `CHECK ((kind = ANY (ARRAY['ical'::text, 'luma'::text, 'meetup'::text])))` and `1`.

- [ ] **Step 3: Update `src/lib/sources/types.ts`**

Replace the kinds/labels lines:

```ts
export const SOURCE_KINDS = ["ical", "luma", "meetup"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  ical: "iCal feed",
  luma: "Luma calendar",
  meetup: "Meetup group",
};
```

In `SourceRun` add after `flagged_missing: number;`:

```ts
  enriched: number;
```

In `RunSummary` add after `flaggedMissing: number;`:

```ts
  /** Events whose page details (cover, description, price) were saved this run. */
  enriched: number;
```

Append at the end of the file:

```ts
export type DetailsStatus = "ok" | "failed" | "blocked";

/** One row per imported event whose source page ORBIT has tried to read. */
export type SourceEventDetails = {
  event_id: string;
  status: DetailsStatus;
  attempts: number;
  last_error: string | null;
  fetched_at: string;
};

export type RefreshSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  sources: RunSummary[];
  expired: number;
  duplicatesFlagged: number;
  errors: string[];
};
```

- [ ] **Step 4: Move `RefreshSummary` out of `engine.ts`**

In `src/lib/sources/engine.ts` delete the `export type RefreshSummary = { … };` block and change the types import line to:

```ts
import { sourceKey, type EventSource, type RefreshSummary, type RunError, type RunSummary, type RunTrigger } from "./types";
```

Add `enriched: 0,` to the `summary` initialiser in `runSource` (after `flaggedMissing: 0,`), and `enriched: summary.enriched,` to the `source_runs` insert (after `flagged_missing: summary.flaggedMissing,`).

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no type errors; all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261020000000_source_platforms.sql src/lib/sources/types.ts src/lib/sources/engine.ts
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): luma and meetup kinds, page details table, enriched run count"
```

---

### Task 2: Platform URL resolving and Luma feed cleanup

**Files:**
- Create: `src/lib/sources/platforms.ts`, `src/lib/sources/platforms.test.ts`
- Modify: `src/lib/sources/connectors.ts`
- Fixture (exists): `src/lib/sources/__fixtures__/luma-calendar.ics` — 4 real events from `cal-7iVMZ4JmmJwQtYl`: `evt-lsdsCjjUhiEn3SX` (2023-01-26), `calev-Nf58gy9UbnWjXJF` (2023-02-11, LOCATION is a website), `evt-h2KaQ3yMes8pjKz` (all-day 2023-09-23), `evt-q9Djl0hCCeyuDPT` (2026-10-28).

**Interfaces:**
- Consumes: `checkFeedUrl` (`url-guard.ts`), `clamp`, `orNull`, `LIMITS` (`text.ts`), `parseIcal` (`ical.ts`), `NormalizedEvent`, `SourceKind`.
- Produces:
  - `resolveFeedUrl(kind: SourceKind, input: string): FeedUrlResult` where `FeedUrlResult = { ok: true; url: string } | { ok: false; error: string }`
  - `cleanEvent(kind: SourceKind, event: NormalizedEvent): NormalizedEvent`
  - `lumaPageUrl(event: { source_event_id: string | null; external_url: string | null }): string | null`
  - `DEFAULT_ATTRIBUTION: Partial<Record<SourceKind, string>>`
  - `CONNECTORS.luma`, `CONNECTORS.meetup`

- [ ] **Step 1: Write the failing tests**

`src/lib/sources/platforms.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseIcal } from "./ical";
import { cleanEvent, lumaPageUrl, resolveFeedUrl } from "./platforms";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

describe("resolveFeedUrl — meetup", () => {
  it.each([
    "https://www.meetup.com/pydata-london-meetup/",
    "https://www.meetup.com/pydata-london-meetup",
    "meetup.com/pydata-london-meetup",
    "www.meetup.com/pydata-london-meetup/events/",
    "https://www.meetup.com/pydata-london-meetup/events/ical/",
    "https://www.meetup.com/en-AU/pydata-london-meetup/",
  ])("turns %s into the group's iCal feed", (input) => {
    expect(resolveFeedUrl("meetup", input)).toEqual({ ok: true, url: "https://www.meetup.com/pydata-london-meetup/events/ical/" });
  });

  it.each(["https://lu.ma/abc", "https://www.meetup.com/", "https://www.meetup.com/find/?location=london", "not a url at all"])(
    "rejects %s",
    (input) => {
      expect(resolveFeedUrl("meetup", input).ok).toBe(false);
    },
  );
});

describe("resolveFeedUrl — luma", () => {
  it("accepts the Subscribe → iCal link and turns webcal into https", () => {
    expect(resolveFeedUrl("luma", "webcal://api.lu.ma/ics/get?entity=calendar&id=cal-7iVMZ4JmmJwQtYl")).toEqual({
      ok: true,
      url: "https://api.lu.ma/ics/get?entity=calendar&id=cal-7iVMZ4JmmJwQtYl",
    });
    expect(resolveFeedUrl("luma", "https://api.luma.com/ics/get?entity=calendar&id=cal-x")).toEqual({
      ok: true,
      url: "https://api.luma.com/ics/get?entity=calendar&id=cal-x",
    });
  });

  it("rejects a calendar page with a hint to paste the iCal link", () => {
    const result = resolveFeedUrl("luma", "https://lu.ma/dwebyvr");
    expect(result).toEqual({ ok: false, error: "That's a Luma page, not its feed. Paste the calendar's Subscribe → iCal link instead." });
  });

  it("rejects other hosts", () => {
    expect(resolveFeedUrl("luma", "https://evil.example.com/ics/get?id=1").ok).toBe(false);
  });
});

describe("resolveFeedUrl — ical", () => {
  it("keeps today's behaviour", () => {
    expect(resolveFeedUrl("ical", "webcal://calendar.example.com/a.ics")).toEqual({ ok: true, url: "https://calendar.example.com/a.ics" });
    expect(resolveFeedUrl("ical", "ftp://calendar.example.com/a.ics").ok).toBe(false);
  });
});

describe("cleanEvent — luma feed fixture", () => {
  it("takes the event link from the stub, sets 'Hosted by' as summary and drops the stub", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2026-10-20T00:00:00Z") });
    expect(events).toHaveLength(1);
    const event = cleanEvent("luma", events[0]);
    expect(event).toMatchObject({
      sourceEventId: "evt-q9Djl0hCCeyuDPT@events.lu.ma",
      title: "Open By Design: Tools for Participation - An Evening with Internet Archive Canada",
      url: "https://luma.com/58wdnop2",
      summary: "Hosted by Andrea Mills",
      description: null,
      venueName: "330 W Pender St",
      format: "in_person",
    });
  });

  it("handles external calendar entries (calev-) and all-day events", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2023-01-01T00:00:00Z") });
    const byId = new Map(events.map((e) => [e.sourceEventId, cleanEvent("luma", e)]));
    expect(byId.get("calev-Nf58gy9UbnWjXJF@events.lu.ma")).toMatchObject({
      url: "https://luma.com/dwebyvr",
      summary: null,
      description: null,
      format: "online",
    });
    expect(byId.get("evt-h2KaQ3yMes8pjKz@events.lu.ma")).toMatchObject({
      allDay: true,
      url: "https://luma.com/ko0jlg5x",
      summary: "Hosted by Kenta Otani",
    });
  });

  it("leaves other kinds untouched", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2026-10-20T00:00:00Z") });
    expect(cleanEvent("meetup", events[0])).toBe(events[0]);
    expect(cleanEvent("ical", events[0])).toBe(events[0]);
  });
});

describe("lumaPageUrl", () => {
  it("only gives a page for evt- events on luma hosts", () => {
    expect(lumaPageUrl({ source_event_id: "evt-q9Djl0hCCeyuDPT@events.lu.ma", external_url: "https://luma.com/58wdnop2" })).toBe("https://luma.com/58wdnop2");
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "https://lu.ma/abc" })).toBe("https://lu.ma/abc");
    expect(lumaPageUrl({ source_event_id: "calev-x@events.lu.ma", external_url: "https://luma.com/dwebyvr" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "https://evil.example.com/abc" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "http://luma.com/abc" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sources/platforms.test.ts`
Expected: FAIL — `Cannot find module './platforms'` (or "Failed to load url ./platforms").

- [ ] **Step 3: Implement `src/lib/sources/platforms.ts`**

```ts
// Platform-specific handling for Luma and Meetup sources: feed URLs, feed clean-up, page links.

import { LIMITS, clamp, orNull } from "./text";
import type { NormalizedEvent, SourceKind } from "./types";
import { checkFeedUrl } from "./url-guard";

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Credit line used when an admin leaves attribution empty. */
export const DEFAULT_ATTRIBUTION: Partial<Record<SourceKind, string>> = {
  luma: "From Luma",
  meetup: "From Meetup",
};

const LUMA_HOSTS = new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com", "api.lu.ma", "api.luma.com"]);
const LUMA_FEED_HOSTS = new Set(["api.lu.ma", "api.luma.com"]);
const LUMA_PAGE_HOSTS = new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com"]);

/** First path segments on meetup.com that are site pages, not groups. */
const MEETUP_RESERVED = new Set([
  "find", "topics", "cities", "events", "login", "register", "apps", "about", "help", "pro", "lp", "blog",
  "home", "messages", "account", "notifications", "create", "start", "members", "groups",
]);
const MEETUP_LOCALE = /^[a-z]{2}-[A-Z]{2}$/;

/** Parses user input that may lack a scheme ("meetup.com/x"). */
function parseLoose(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function finalCheck(url: string): FeedUrlResult {
  const check = checkFeedUrl(url);
  return check.ok ? { ok: true, url: check.url.toString() } : { ok: false, error: check.error };
}

function resolveMeetup(input: string): FeedUrlResult {
  const url = parseLoose(input);
  const host = url?.hostname.toLowerCase().replace(/^www\./, "");
  if (!url || host !== "meetup.com") {
    return { ok: false, error: "Paste a Meetup group link, e.g. https://www.meetup.com/your-group/" };
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const urlname = MEETUP_LOCALE.test(segments[0] ?? "") ? segments[1] : segments[0];
  if (!urlname || MEETUP_RESERVED.has(urlname.toLowerCase()) || !/^[A-Za-z0-9-]{2,80}$/.test(urlname)) {
    return { ok: false, error: "That isn't a Meetup group link. Open the group and copy its address, e.g. https://www.meetup.com/your-group/" };
  }
  return finalCheck(`https://www.meetup.com/${urlname}/events/ical/`);
}

function resolveLuma(input: string): FeedUrlResult {
  const url = parseLoose(input.trim().replace(/^webcal:\/\//i, "https://"));
  const host = url?.hostname.toLowerCase();
  if (!url || !host || !LUMA_HOSTS.has(host)) {
    return { ok: false, error: "Paste the calendar's Subscribe → iCal link from Luma (it starts with webcal://api.lu.ma/ics/…)." };
  }
  if (!LUMA_FEED_HOSTS.has(host) || !url.pathname.startsWith("/ics/")) {
    return { ok: false, error: "That's a Luma page, not its feed. Paste the calendar's Subscribe → iCal link instead." };
  }
  return finalCheck(url.toString());
}

/** Turns what an admin pasted into the feed URL ORBIT fetches. */
export function resolveFeedUrl(kind: SourceKind, input: string): FeedUrlResult {
  if (kind === "meetup") return resolveMeetup(input);
  if (kind === "luma") return resolveLuma(input);
  return finalCheck(input);
}

// Luma's feed DESCRIPTION is only a stub:
//   "Get up-to-date information at: https://luma.com/<slug>\n\nAddress:\n…\n\nHosted by <host>"
// or, for external entries (calev-…): "Find more information on https://luma.com/<calendar>".
const LUMA_LINK = /https:\/\/(?:www\.)?(?:luma\.com|lu\.ma)\/[A-Za-z0-9_-]+/;
const HOSTED_BY = /^Hosted by (.+)$/m;

/** Platform tidy-up after parsing the feed. Other kinds pass through unchanged. */
export function cleanEvent(kind: SourceKind, event: NormalizedEvent): NormalizedEvent {
  if (kind !== "luma") return event;
  const stub = event.description ?? "";
  const host = stub.match(HOSTED_BY)?.[1]?.trim();
  return {
    ...event,
    url: event.url ?? stub.match(LUMA_LINK)?.[0] ?? null,
    description: null,
    summary: host ? orNull(clamp(`Hosted by ${host}`, LIMITS.summary)) : null,
  };
}

/** The Luma page to read for an imported event, or null when it isn't a Luma event page. */
export function lumaPageUrl(event: { source_event_id: string | null; external_url: string | null }): string | null {
  if (!event.source_event_id?.startsWith("evt-") || !event.external_url) return null;
  try {
    const url = new URL(event.external_url);
    return url.protocol === "https:" && LUMA_PAGE_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Register connectors in `src/lib/sources/connectors.ts`**

Replace the whole file with:

```ts
import "server-only";
import { fetchFeedText } from "./fetch";
import { parseIcal } from "./ical";
import { cleanEvent } from "./platforms";
import type { SourceConnector, SourceKind } from "./types";

/** iCal feeds, with the platform's own clean-up for Luma / Meetup. */
function feedConnector(kind: SourceKind): SourceConnector {
  return {
    kind,
    async fetchEvents(source, { now }) {
      const text = await fetchFeedText(source.url);
      const result = parseIcal(text, { now });
      return { ...result, events: result.events.map((e) => cleanEvent(kind, e)) };
    },
  };
}

/** Add new kinds here (official APIs etc.) — the sync engine only sees NormalizedEvent[]. */
export const CONNECTORS: Record<SourceKind, SourceConnector> = {
  ical: feedConnector("ical"),
  luma: feedConnector("luma"),
  meetup: feedConnector("meetup"),
};
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/sources/platforms.test.ts && npm test`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sources/platforms.ts src/lib/sources/platforms.test.ts src/lib/sources/connectors.ts src/lib/sources/__fixtures__
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): resolve luma and meetup feed links and clean luma feed events"
```

---

### Task 3: Sync plan — per-kind label and fields the feed doesn't own

**Files:**
- Modify: `src/lib/sources/sync-plan.ts`, `src/lib/sources/sync-plan.test.ts`, `src/lib/sources/engine.ts`

**Interfaces:**
- Consumes: `SourceKind`.
- Produces: `EXTERNAL_LABELS: Record<SourceKind, string>`, `SKIPPED_FIELDS: Partial<Record<SourceKind, readonly (keyof SyncedFields)[]>>`, `changedFields(existing, incoming, skip?)`, `planSync(..., { …, skip? })`, `buildInsertRow(event, source & { kind?: SourceKind }, now)`.

- [ ] **Step 1: Write failing tests** — append to `src/lib/sources/sync-plan.test.ts`:

```ts
import { EXTERNAL_LABELS, SKIPPED_FIELDS } from "./sync-plan";

describe("luma sources", () => {
  const source = { id: "src-1", url: FEED, default_organiser_id: null, default_category_id: null, default_tags: [] };

  it("labels the register button by kind", () => {
    expect(buildInsertRow(incoming("a"), { ...source, kind: "luma" }, NOW).external_label).toBe("Register on Luma");
    expect(buildInsertRow(incoming("a"), { ...source, kind: "meetup" }, NOW).external_label).toBe("Register on Meetup");
    expect(buildInsertRow(incoming("a"), source, NOW).external_label).toBe("View details");
    expect(EXTERNAL_LABELS.ical).toBe("View details");
  });

  it("never overwrites a description the feed doesn't have", () => {
    const n = incoming("a", { description: null });
    const existing = existingFrom(n, { description: "Pasted by an admin" });
    const plan = planSync([existing], [n], { now: NOW, feedUrl: FEED, previousRunStartedAt, skip: SKIPPED_FIELDS.luma });
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toEqual([existing.id]);

    const withoutSkip = planSync([existing], [n], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(withoutSkip.updates[0].patch).toEqual({ description: null });
  });

  it("still updates the fields the feed owns, and never touches cover or price", () => {
    const n = incoming("a", { description: null, title: "New title" });
    const existing = existingFrom(incoming("a", { description: null }), { description: "Pasted" });
    const patch = changedFields(existing, syncedFields(n, FEED), SKIPPED_FIELDS.luma);
    expect(patch).toEqual({ title: "New title" });
    expect(Object.keys(patch)).not.toContain("cover_url");
    expect(Object.keys(patch)).not.toContain("price_min");
  });
});
```

(Merge the new `import` into the existing import line from `./sync-plan` at the top of the file instead of adding a second import statement.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sources/sync-plan.test.ts`
Expected: FAIL — `EXTERNAL_LABELS` / `SKIPPED_FIELDS` not exported, `skip` ignored.

- [ ] **Step 3: Implement in `src/lib/sources/sync-plan.ts`**

Change the types import to:

```ts
import type { EventSource, NormalizedEvent, SourceKind } from "./types";
```

Add after the `SyncedFields` type:

```ts
/** Label on the "register" button of imported events, by source kind. */
export const EXTERNAL_LABELS: Record<SourceKind, string> = {
  ical: "View details",
  luma: "Register on Luma",
  meetup: "Register on Meetup",
};

/** Synced fields a kind's feed doesn't really have, so updates leave them alone
 *  (Luma's feed only carries a stub description; the real one comes from the page or an admin). */
export const SKIPPED_FIELDS: Partial<Record<SourceKind, readonly (keyof SyncedFields)[]>> = {
  luma: ["description"],
};
```

In `buildInsertRow`, change the `source` parameter type and the label:

```ts
  source: Pick<EventSource, "id" | "url" | "default_organiser_id" | "default_category_id" | "default_tags"> & { kind?: SourceKind },
```

```ts
    external_label: EXTERNAL_LABELS[source.kind ?? "ical"],
```

Replace `changedFields` signature and first lines:

```ts
export function changedFields(
  existing: ExistingSourceEvent,
  incoming: SyncedFields,
  skip: readonly (keyof SyncedFields)[] = [],
): Partial<SyncedFields> {
  const patch: Partial<SyncedFields> = {};
  const next = { ...incoming };
  for (const key of skip) delete next[key];
```

(keep the rest of the function as is).

In `planSync`, change the options parameter and the `changedFields` call:

```ts
  { now, feedUrl, previousRunStartedAt, skip = [] }: {
    now: Date;
    feedUrl: string;
    previousRunStartedAt: Date | null;
    skip?: readonly (keyof SyncedFields)[];
  },
```

```ts
    const patch = changedFields(current, syncedFields(event, feedUrl), skip);
```

- [ ] **Step 4: Wire into `src/lib/sources/engine.ts`**

Change the sync-plan import to:

```ts
import { EXISTING_EVENT_SELECT, SKIPPED_FIELDS, buildInsertRow, planSync, type ExistingSourceEvent } from "./sync-plan";
```

and the `planSync` call to:

```ts
    const plan = planSync(existing, fetched.events, {
      now, feedUrl: source.url, previousRunStartedAt, skip: SKIPPED_FIELDS[source.kind],
    });
```

(`buildInsertRow(e, source, now)` already passes the full source, which now includes `kind`.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/sources/sync-plan.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sources/sync-plan.ts src/lib/sources/sync-plan.test.ts src/lib/sources/engine.ts
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): per-kind register label and keep fields luma feeds don't own"
```

---

### Task 4: Luma event page parser

**Files:**
- Create: `src/lib/sources/luma-page.ts`, `src/lib/sources/luma-page.test.ts`
- Fixture (exists): `src/lib/sources/__fixtures__/luma-event.html` — trimmed `luma.com/van-dweb-social` (og meta tags + JSON-LD `Event`).

**Interfaces:**
- Consumes: `stripHtml`, `clamp`, `orNull`, `decodeEntities`, `LIMITS` (`text.ts`).
- Produces: `type LumaPageDetails = { coverUrl: string | null; description: string | null; priceMin: number | null; priceMax: number | null; currency: string | null }`, `parseLumaEventPage(html: string): LumaPageDetails | null`.

- [ ] **Step 1: Write failing tests** — `src/lib/sources/luma-page.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLumaEventPage } from "./luma-page";

const page = readFileSync(fileURLToPath(new URL("./__fixtures__/luma-event.html", import.meta.url)), "utf8");

const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;

describe("parseLumaEventPage", () => {
  it("reads cover, full description and price from the real page", () => {
    const details = parseLumaEventPage(page);
    expect(details).not.toBeNull();
    expect(details!.coverUrl).toMatch(/^https:\/\/cdn\.lu\.ma\/.*event-covers\/is\/b1513072-d1d5-4d13-8d81-9ed02b4c4d03/);
    expect(details!.description).toMatch(/^Did you know that the Internet Archive now has a Canadian edition\?/);
    expect(details!.description!.length).toBeGreaterThan(1000);
    expect(details).toMatchObject({ priceMin: 0, priceMax: 0, currency: "USD" });
  });

  it("falls back to og:image when there is no JSON-LD", () => {
    const html = page.replace(/<script[^>]*application\/ld\+json[\s\S]*?<\/script>/, "");
    const details = parseLumaEventPage(html);
    expect(details?.coverUrl).toMatch(/^https:\/\/cdn\.lu\.ma\//);
    expect(details?.description).toBeNull();
    expect(details?.priceMin).toBeNull();
  });

  it("ignores images on other hosts", () => {
    expect(parseLumaEventPage(ld({ "@type": "Event", image: ["https://evil.example.com/a.jpg"] }))).toBeNull();
  });

  it("gives a price range for several offers in one currency", () => {
    const details = parseLumaEventPage(ld({
      "@type": "Event",
      offers: [{ price: 5, priceCurrency: "gbp" }, { price: "12.5", priceCurrency: "GBP" }],
    }));
    expect(details).toMatchObject({ priceMin: 5, priceMax: 12.5, currency: "GBP" });
  });

  it("gives no price for mixed currencies or missing prices", () => {
    expect(parseLumaEventPage(ld({ "@type": "Event", description: "x", offers: [{ price: 5, priceCurrency: "GBP" }, { price: 5, priceCurrency: "USD" }] }))?.priceMin).toBeNull();
    expect(parseLumaEventPage(ld({ "@type": "Event", description: "x", offers: [{ priceCurrency: "GBP" }] }))?.priceMin).toBeNull();
  });

  it("finds the Event inside an array and skips malformed blocks", () => {
    const html = `<script type="application/ld+json">{not json</script>${ld([{ "@type": "Organization" }, { "@type": "Event", description: "<p>Hi &amp; welcome</p>" }])}`;
    expect(parseLumaEventPage(html)?.description).toBe("Hi & welcome");
  });

  it("returns null for pages with nothing useful", () => {
    expect(parseLumaEventPage("<html><body>Not found</body></html>")).toBeNull();
    expect(parseLumaEventPage("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sources/luma-page.test.ts`
Expected: FAIL — module `./luma-page` not found.

- [ ] **Step 3: Implement `src/lib/sources/luma-page.ts`**

```ts
// Reads a Luma event page's schema.org Event data (the JSON-LD Luma publishes for search engines).

import { LIMITS, clamp, decodeEntities, orNull, stripHtml } from "./text";

export type LumaPageDetails = {
  coverUrl: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
};

const IMAGE_HOSTS = new Set(["cdn.lu.ma", "images.lumacdn.com"]);

function safeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function firstEvent(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (item && typeof item === "object" && (item as Record<string, unknown>)["@type"] === "Event") {
        return item as Record<string, unknown>;
      }
    }
  }
  return null;
}

function ogImage(html: string): string | null {
  const tag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1];
  return content ? safeImage(decodeEntities(content)) : null;
}

/** A price range only when every offer has a number and they share one currency. */
function prices(offers: unknown): { priceMin: number; priceMax: number; currency: string } | null {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  if (list.length === 0) return null;
  const values: number[] = [];
  let currency: string | null = null;
  for (const offer of list as Record<string, unknown>[]) {
    const raw = offer?.price;
    const price = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(price) || price < 0) return null;
    const code = typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim().toUpperCase() : "";
    if (!code || (currency && code !== currency)) return null;
    currency = code;
    values.push(price);
  }
  return { priceMin: Math.min(...values), priceMax: Math.max(...values), currency: currency! };
}

/** Cover, full description and price from a Luma event page, or null when the page has none. */
export function parseLumaEventPage(html: string): LumaPageDetails | null {
  const event = firstEvent(html);
  const images = event ? (Array.isArray(event.image) ? event.image : [event.image]) : [];
  const coverUrl = images.map(safeImage).find((u): u is string => u !== null) ?? ogImage(html);
  const description = orNull(clamp(stripHtml(typeof event?.description === "string" ? event.description : ""), LIMITS.description));
  const price = event ? prices(event.offers) : null;
  if (!coverUrl && !description && !price) return null;
  return {
    coverUrl,
    description,
    priceMin: price?.priceMin ?? null,
    priceMax: price?.priceMax ?? null,
    currency: price?.currency ?? null,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/sources/luma-page.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/luma-page.ts src/lib/sources/luma-page.test.ts
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): parse cover, description and price from luma event pages"
```

---

### Task 5: Enrichment — rules, fetch, Cloudinary import, engine step

**Files:**
- Create: `src/lib/sources/enrich-plan.ts`, `src/lib/sources/enrich-plan.test.ts`, `src/lib/sources/cloudinary-import.ts`, `src/lib/sources/enrich.ts`
- Modify: `src/lib/sources/fetch.ts`, `src/lib/sources/engine.ts`

**Interfaces:**
- Consumes: `lumaPageUrl` (Task 2), `parseLumaEventPage`, `LumaPageDetails` (Task 4), `SourceEventDetails`, `DetailsStatus`, `RunError` (Task 1), `getCloudinaryConfig`, `signParams` (`@/lib/cloudinary`).
- Produces:
  - `enrich-plan.ts`: `ENRICH_LIMIT = 25`, `MAX_ATTEMPTS = 3`, `RETRY_AFTER_MS = 86_400_000`, `ENRICH_BUDGET_MS = 120_000`, `PAUSE_MS = 1000`, `type EnrichCandidate`, `pickEventsToEnrich(events, details, now, limit?)`, `isBlockedStatus(status)`, `detailsPatch(current, page, importedCover)`.
  - `fetch.ts`: `class FetchHttpError extends Error { status: number }`, `fetchFeedText(url, { accept? })`.
  - `cloudinary-import.ts`: `importRemoteImage(imageUrl: string, folder: string): Promise<string>`.
  - `enrich.ts`: `enrichLumaEvents(source: Pick<EventSource, "id">, opts: { db: SupabaseClient; now: Date; errors: RunError[] }): Promise<number>`.

- [ ] **Step 1: Write failing tests** — `src/lib/sources/enrich-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, detailsPatch, isBlockedStatus, pickEventsToEnrich, type EnrichCandidate } from "./enrich-plan";
import type { SourceEventDetails } from "./types";

const NOW = new Date("2026-10-20T03:00:00Z");

const event = (id: string, over: Partial<EnrichCandidate> = {}): EnrichCandidate => ({
  id,
  source_event_id: `evt-${id}@events.lu.ma`,
  external_url: `https://luma.com/${id}`,
  starts_at: "2026-10-28T18:00:00+00:00",
  created_at: "2026-10-19T03:00:00+00:00",
  cover_url: null,
  description: null,
  price_min: null,
  ...over,
});

const row = (id: string, over: Partial<SourceEventDetails> = {}): [string, SourceEventDetails] => [
  id,
  { event_id: id, status: "failed", attempts: 1, last_error: "x", fetched_at: "2026-10-18T03:00:00+00:00", ...over },
];

describe("pickEventsToEnrich", () => {
  it("picks upcoming Luma event pages that were never read", () => {
    const picked = pickEventsToEnrich(
      [event("a"), event("past", { starts_at: "2026-10-01T18:00:00+00:00" }), event("calev", { source_event_id: "calev-x@events.lu.ma" })],
      new Map(),
      NOW,
    );
    expect(picked.map((e) => e.id)).toEqual(["a"]);
  });

  it("retries failed rows after a day, up to the attempt limit, and never ok/blocked rows", () => {
    const details = new Map([
      row("old-fail"),
      row("fresh-fail", { fetched_at: "2026-10-20T01:00:00+00:00" }),
      row("too-many", { attempts: MAX_ATTEMPTS }),
      row("done", { status: "ok" }),
      row("blocked", { status: "blocked" }),
    ]);
    const picked = pickEventsToEnrich(["old-fail", "fresh-fail", "too-many", "done", "blocked"].map((id) => event(id)), details, NOW);
    expect(picked.map((e) => e.id)).toEqual(["old-fail"]);
  });

  it("takes the newest first, up to the limit", () => {
    const events = Array.from({ length: 30 }, (_, i) => event(`e${i}`, { created_at: `2026-10-${String(i % 28 + 1).padStart(2, "0")}T00:00:00+00:00` }));
    const picked = pickEventsToEnrich(events, new Map(), NOW, 25);
    expect(picked).toHaveLength(25);
    expect(picked[0].created_at >= picked[24].created_at).toBe(true);
  });
});

describe("isBlockedStatus", () => {
  it("treats 403, 429 and 503 as blocking", () => {
    expect([403, 429, 503].every(isBlockedStatus)).toBe(true);
    expect([404, 500].some(isBlockedStatus)).toBe(false);
  });
});

describe("detailsPatch", () => {
  const page = { coverUrl: "https://cdn.lu.ma/x", description: "Full text", priceMin: 0, priceMax: 10, currency: "GBP" };

  it("fills empty fields", () => {
    expect(detailsPatch(event("a"), page, "https://res.cloudinary.com/demo/image/upload/x.jpg")).toEqual({
      cover_url: "https://res.cloudinary.com/demo/image/upload/x.jpg",
      description: "Full text",
      price_min: 0,
      price_max: 10,
      currency: "GBP",
    });
  });

  it("never overwrites what an admin set", () => {
    const current = event("a", { cover_url: "https://res.cloudinary.com/mine.jpg", description: "Mine", price_min: 5 });
    expect(detailsPatch(current, page, "https://res.cloudinary.com/other.jpg")).toEqual({});
  });

  it("skips the cover when the import failed", () => {
    expect(detailsPatch(event("a"), page, null)).not.toHaveProperty("cover_url");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sources/enrich-plan.test.ts`
Expected: FAIL — module `./enrich-plan` not found.

- [ ] **Step 3: Implement `src/lib/sources/enrich-plan.ts`**

```ts
// Pure rules for reading Luma event pages: which events, when to stop, what to fill.

import type { LumaPageDetails } from "./luma-page";
import { lumaPageUrl } from "./platforms";
import type { SourceEventDetails } from "./types";

export const ENRICH_LIMIT = 25; // pages per source per run
export const MAX_ATTEMPTS = 3;
export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
export const ENRICH_BUDGET_MS = 120_000; // per source, keeps the cron well under its 300 s limit
export const PAUSE_MS = 1000; // between page reads

export type EnrichCandidate = {
  id: string;
  source_event_id: string | null;
  external_url: string | null;
  starts_at: string;
  created_at: string;
  cover_url: string | null;
  description: string | null;
  price_min: number | null;
};

/** Upcoming Luma events never read, or failed ones due a retry; newest first. */
export function pickEventsToEnrich(
  events: EnrichCandidate[],
  details: Map<string, Pick<SourceEventDetails, "status" | "attempts" | "fetched_at">>,
  now: Date,
  limit = ENRICH_LIMIT,
): EnrichCandidate[] {
  return events
    .filter((e) => {
      if (!lumaPageUrl(e) || new Date(e.starts_at).getTime() <= now.getTime()) return false;
      const d = details.get(e.id);
      if (!d) return true;
      return d.status === "failed" && d.attempts < MAX_ATTEMPTS && now.getTime() - new Date(d.fetched_at).getTime() >= RETRY_AFTER_MS;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** Luma is refusing or rate-limiting us: stop reading pages for this run. */
export const isBlockedStatus = (status: number) => status === 403 || status === 429 || status === 503;

export type DetailsPatch = { cover_url?: string; description?: string; price_min?: number; price_max?: number; currency?: string };

/** Only fills fields that are empty, so admin edits always win. */
export function detailsPatch(
  current: Pick<EnrichCandidate, "cover_url" | "description" | "price_min">,
  page: LumaPageDetails,
  importedCover: string | null,
): DetailsPatch {
  const patch: DetailsPatch = {};
  if (!current.cover_url && importedCover) patch.cover_url = importedCover;
  if (!current.description && page.description) patch.description = page.description;
  if (current.price_min === null && page.priceMin !== null && page.priceMax !== null && page.currency) {
    patch.price_min = page.priceMin;
    patch.price_max = page.priceMax;
    patch.currency = page.currency;
  }
  return patch;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/sources/enrich-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `FetchHttpError` and `accept` to `src/lib/sources/fetch.ts`**

Add below the constants:

```ts
/** An HTTP error status from the remote server (lets callers react to 403 / 429 / 503). */
export class FetchHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FetchHttpError";
  }
}
```

Change the function signature and the `Accept` header:

```ts
export async function fetchFeedText(
  rawUrl: string,
  { accept = "text/calendar, text/plain;q=0.8, */*;q=0.1" }: { accept?: string } = {},
): Promise<string> {
```

```ts
        headers: { "User-Agent": USER_AGENT, Accept: accept },
```

Replace the two status `throw new Error(…)` lines with:

```ts
    if (response.status === 429 || response.status === 503) {
      throw new FetchHttpError(`The feed asked us to slow down (HTTP ${response.status}). We'll try again on the next refresh.`, response.status);
    }
    if (!response.ok) {
      throw new FetchHttpError(`The feed returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`, response.status);
    }
```

- [ ] **Step 6: Create `src/lib/sources/cloudinary-import.ts`**

```ts
import "server-only";
import { getCloudinaryConfig, signParams } from "@/lib/cloudinary";

/**
 * Has Cloudinary fetch a remote image and store ORBIT's own copy; returns its secure URL.
 * ORBIT's server never downloads the image itself.
 */
export async function importRemoteImage(imageUrl: string, folder: string): Promise<string> {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Image import needs Cloudinary (CLOUDINARY_* env vars are missing).");
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("That image link isn't a valid URL.");
  }
  if (url.protocol !== "https:") throw new Error("Image links must start with https://");

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new FormData();
  body.set("file", url.toString());
  body.set("api_key", config.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("folder", folder);
  body.set("signature", signParams({ folder, timestamp }, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!response.ok || !json?.secure_url) {
    throw new Error(`Cloudinary couldn't import the image: ${json?.error?.message ?? `HTTP ${response.status}`}`);
  }
  return json.secure_url;
}
```

- [ ] **Step 7: Create `src/lib/sources/enrich.ts`**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { importRemoteImage } from "./cloudinary-import";
import { ENRICH_BUDGET_MS, PAUSE_MS, detailsPatch, isBlockedStatus, pickEventsToEnrich, type EnrichCandidate } from "./enrich-plan";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseLumaEventPage } from "./luma-page";
import { lumaPageUrl } from "./platforms";
import { sourceKey, type DetailsStatus, type EventSource, type RunError, type SourceEventDetails } from "./types";

// Trusted server code only (called from the sync engine with the service-role client).

const CANDIDATE_SELECT = "id, source_event_id, external_url, starts_at, created_at, cover_url, description, price_min";
const COVER_FOLDER = "orbit/event-covers/sources";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads new Luma event pages once each (politely, stopping if Luma blocks us) and fills in
 * empty cover / description / price. Returns how many events got details. Never throws.
 */
export async function enrichLumaEvents(
  source: Pick<EventSource, "id">,
  { db, now, errors }: { db: SupabaseClient; now: Date; errors: RunError[] },
): Promise<number> {
  const key = sourceKey(source.id);
  const { data, error } = await db
    .from("events")
    .select(CANDIDATE_SELECT)
    .eq("source", key)
    .eq("status", "published")
    .gt("starts_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    errors.push({ message: `Page details: ${error.message}` });
    return 0;
  }
  const events = (data ?? []) as EnrichCandidate[];
  if (events.length === 0) return 0;

  const details = new Map<string, SourceEventDetails>();
  for (let i = 0; i < events.length; i += 200) {
    const ids = events.slice(i, i + 200).map((e) => e.id);
    const { data: rows } = await db.from("source_event_details").select("*").in("event_id", ids);
    for (const r of (rows ?? []) as SourceEventDetails[]) details.set(r.event_id, r);
  }

  const picked = pickEventsToEnrich(events, details, now);
  const started = Date.now();
  let saved = 0;

  for (const [i, event] of picked.entries()) {
    if (Date.now() - started > ENRICH_BUDGET_MS) break;
    if (i > 0) await sleep(PAUSE_MS);
    const url = lumaPageUrl(event)!;
    const attempts = (details.get(event.id)?.attempts ?? 0) + 1;
    const record = (status: DetailsStatus, lastError: string | null = null) =>
      db.from("source_event_details").upsert(
        { event_id: event.id, status, attempts, last_error: lastError?.slice(0, 500) ?? null, fetched_at: new Date().toISOString() },
        { onConflict: "event_id" },
      );

    try {
      const page = parseLumaEventPage(await fetchFeedText(url, { accept: "text/html" }));
      if (!page) {
        await record("failed", "No event details found on the page.");
        continue;
      }
      let cover: string | null = null;
      let coverError: string | null = null;
      if (!event.cover_url && page.coverUrl) {
        try {
          cover = await importRemoteImage(page.coverUrl, COVER_FOLDER);
        } catch (e) {
          coverError = message(e);
        }
      }
      const patch = detailsPatch(event, page, cover);
      if (Object.keys(patch).length) {
        const { error: updateError } = await db.from("events").update(patch).eq("id", event.id).eq("source", key);
        if (updateError) {
          await record("failed", updateError.message);
          continue;
        }
        saved++;
      }
      await record(coverError ? "failed" : "ok", coverError);
      if (coverError) errors.push({ event: event.source_event_id ?? event.id, message: `Cover not imported: ${coverError}` });
    } catch (e) {
      if (e instanceof FetchHttpError && isBlockedStatus(e.status)) {
        await record("blocked", e.message);
        errors.push({ message: "Luma is blocking page reads. Paste or upload images for now." });
        break;
      }
      await record("failed", message(e));
      errors.push({ event: event.source_event_id ?? event.id, message: `Page details: ${message(e)}` });
    }
  }
  return saved;
}
```

- [ ] **Step 8: Call it from `runSource` in `src/lib/sources/engine.ts`**

Add the import:

```ts
import { enrichLumaEvents } from "./enrich";
```

Directly before `summary.status = "ok";` add:

```ts
    if (source.kind === "luma") summary.enriched = await enrichLumaEvents(source, { db, now, errors });
```

- [ ] **Step 9: Typecheck and test**

Run: `npx tsc --noEmit -p . && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/sources/enrich-plan.ts src/lib/sources/enrich-plan.test.ts src/lib/sources/cloudinary-import.ts src/lib/sources/enrich.ts src/lib/sources/fetch.ts src/lib/sources/engine.ts
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): read new luma event pages once for cover, description and price"
```

---

### Task 6: "Refresh all now" through the cron route

**Files:**
- Create: `src/lib/sources/refresh-auth.ts`, `src/lib/sources/refresh-auth.test.ts`, `src/lib/sources/refresh-summary.ts`, `src/lib/sources/refresh-summary.test.ts`, `src/app/admin/sources/_components/RefreshAllButton.tsx`
- Modify: `src/app/api/cron/refresh-sources/route.ts`, `src/lib/sources/engine.ts`, `src/app/admin/sources/page.tsx`

**Interfaces:**
- Consumes: `RefreshSummary`, `RunTrigger` (types), `getProfile`, `isAdmin` (`@/lib/auth`), `refreshAllSources`.
- Produces: `authoriseRefresh(input): RefreshAuth` with `RefreshAuth = { ok: true; trigger: RunTrigger } | { ok: false; status: 401 | 403 }`; `formatRefreshSummary(summary: RefreshSummary): string`; `refreshAllSources({ now?, trigger? })`; `<RefreshAllButton />`.

- [ ] **Step 1: Write failing tests**

`src/lib/sources/refresh-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authoriseRefresh } from "./refresh-auth";

const SECRET = "s3cret-value";

describe("authoriseRefresh", () => {
  it("lets the Vercel cron in with the secret", () => {
    expect(authoriseRefresh({ method: "GET", authorization: `Bearer ${SECRET}`, cronSecret: SECRET })).toEqual({ ok: true, trigger: "cron" });
  });

  it("refuses GET without the right secret, or when no secret is configured", () => {
    expect(authoriseRefresh({ method: "GET", authorization: "Bearer wrong", cronSecret: SECRET })).toEqual({ ok: false, status: 401 });
    expect(authoriseRefresh({ method: "GET", authorization: null, cronSecret: SECRET })).toEqual({ ok: false, status: 401 });
    expect(authoriseRefresh({ method: "GET", authorization: "Bearer ", cronSecret: undefined })).toEqual({ ok: false, status: 401 });
  });

  it("lets a signed-in admin in from the same site", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "https://orbit.akshatgg.in", host: "orbit.akshatgg.in" })).toEqual({ ok: true, trigger: "manual" });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "http://localhost:3000", host: "localhost:3000" })).toEqual({ ok: true, trigger: "manual" });
  });

  it("refuses admins from another site or without an origin", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "https://evil.example.com", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: null, host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "garbage", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
  });

  it("refuses non-admins and anonymous POSTs", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: false, origin: "https://orbit.akshatgg.in", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 401 });
  });
});
```

`src/lib/sources/refresh-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatRefreshSummary } from "./refresh-summary";
import type { RefreshSummary, RunSummary } from "./types";

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  sourceId: "s", name: "S", status: "ok", found: 0, inserted: 0, updated: 0, unchanged: 0, flaggedMissing: 0, enriched: 0, errors: [], ...over,
});

const summary = (sources: RunSummary[], over: Partial<RefreshSummary> = {}): RefreshSummary => ({
  ok: true, startedAt: "", finishedAt: "", sources, expired: 0, duplicatesFlagged: 0, errors: [], ...over,
});

describe("formatRefreshSummary", () => {
  it("adds up every source", () => {
    const text = formatRefreshSummary(summary(
      [run({ inserted: 10, updated: 4, unchanged: 20, enriched: 9 }), run({ inserted: 2 }), run({ status: "error" })],
      { duplicatesFlagged: 1 },
    ));
    expect(text).toBe("3 sources · 12 new · 4 updated · 20 unchanged · 9 with page details · 1 possible duplicate · 1 failed");
  });

  it("keeps it short when nothing happened", () => {
    expect(formatRefreshSummary(summary([run()]))).toBe("1 source · 0 new · 0 updated · 0 unchanged");
    expect(formatRefreshSummary(summary([]))).toBe("0 sources · 0 new · 0 updated · 0 unchanged");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sources/refresh-auth.test.ts src/lib/sources/refresh-summary.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/sources/refresh-auth.ts`**

```ts
// Who may trigger a full refresh: the Vercel cron (secret) or a signed-in admin on this site.

import { timingSafeEqual } from "node:crypto";
import type { RunTrigger } from "./types";

export type RefreshAuth = { ok: true; trigger: RunTrigger } | { ok: false; status: 401 | 403 };

type Input =
  | { method: "GET"; authorization: string | null; cronSecret: string | undefined }
  | { method: "POST"; isAdmin: boolean; origin: string | null; host: string | null };

function secretMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const given = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function authoriseRefresh(input: Input): RefreshAuth {
  if (input.method === "GET") {
    return secretMatches(input.authorization, input.cronSecret) ? { ok: true, trigger: "cron" } : { ok: false, status: 401 };
  }
  if (!input.isAdmin) return { ok: false, status: 401 };
  // Route handlers don't get Server Actions' origin check, so do it here (CSRF).
  if (!input.origin || !input.host) return { ok: false, status: 403 };
  try {
    return new URL(input.origin).host === input.host ? { ok: true, trigger: "manual" } : { ok: false, status: 403 };
  } catch {
    return { ok: false, status: 403 };
  }
}
```

- [ ] **Step 4: Implement `src/lib/sources/refresh-summary.ts`**

```ts
import type { RefreshSummary, RunSummary } from "./types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One line for the admin, e.g. "3 sources · 12 new · 4 updated · 20 unchanged · 1 possible duplicate". */
export function formatRefreshSummary(summary: RefreshSummary): string {
  const total = (key: "inserted" | "updated" | "unchanged" | "enriched") =>
    summary.sources.reduce((n, s: RunSummary) => n + (s[key] ?? 0), 0);
  const parts = [
    plural(summary.sources.length, "source"),
    `${total("inserted")} new`,
    `${total("updated")} updated`,
    `${total("unchanged")} unchanged`,
  ];
  const enriched = total("enriched");
  if (enriched) parts.push(`${enriched} with page details`);
  if (summary.duplicatesFlagged) parts.push(plural(summary.duplicatesFlagged, "possible duplicate"));
  const failed = summary.sources.filter((s) => s.status === "error").length;
  if (failed) parts.push(`${failed} failed`);
  return parts.join(" · ");
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/sources/refresh-auth.test.ts src/lib/sources/refresh-summary.test.ts`
Expected: PASS.

- [ ] **Step 6: Pass the trigger through `refreshAllSources` (`src/lib/sources/engine.ts`)**

```ts
export async function refreshAllSources(
  { now = new Date(), trigger = "cron" }: { now?: Date; trigger?: RunTrigger } = {},
): Promise<RefreshSummary> {
```

and inside the loop:

```ts
      sources.push(await runSource(id, { trigger, db }));
```

- [ ] **Step 7: Replace `src/app/api/cron/refresh-sources/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { refreshAllSources } from "@/lib/sources/engine";
import { authoriseRefresh } from "@/lib/sources/refresh-auth";

// One entry point for a full refresh of every enabled source (then expiry and duplicate checks):
// GET  — Vercel cron (daily 03:00 UTC, see vercel.json) with Authorization: Bearer $CRON_SECRET.
// POST — the "Refresh all now" button on /admin/sources, for signed-in admins on this site.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = authoriseRefresh({
    method: "GET",
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const summary = await refreshAllSources({ trigger: auth.trigger });
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  const auth = authoriseRefresh({
    method: "POST",
    isAdmin: isAdmin(profile),
    origin: request.headers.get("origin"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 403 ? "Forbidden" : "Sign in as an admin to refresh sources." }, { status: auth.status });
  }
  const summary = await refreshAllSources({ trigger: auth.trigger });
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 8: Create `src/app/admin/sources/_components/RefreshAllButton.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRefreshSummary } from "@/lib/sources/refresh-summary";
import type { RefreshSummary } from "@/lib/sources/types";

/** Runs the same full refresh as the nightly cron, then shows what changed. */
export function RefreshAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/cron/refresh-sources", { method: "POST" });
      const data = (await response.json().catch(() => null)) as (Partial<RefreshSummary> & { error?: string }) | null;
      if (!response.ok || !data || !Array.isArray(data.sources)) {
        setResult({ ok: false, text: `Refresh failed: ${data?.error ?? `HTTP ${response.status}`}` });
        return;
      }
      const summary = data as RefreshSummary;
      const issues = summary.errors.length + summary.sources.reduce((n, s) => n + s.errors.length, 0);
      setResult({
        ok: summary.ok,
        text: `${formatRefreshSummary(summary)}${issues ? ` · ${issues} issue${issues === 1 ? "" : "s"} (see Recent runs)` : ""}`,
      });
      router.refresh();
    } catch {
      setResult({ ok: false, text: "Refresh failed: couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="md" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? "Refreshing…" : "Refresh all now"}
      </Button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`max-w-sm text-right text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Put it in the page header (`src/app/admin/sources/page.tsx`)**

Add the import:

```ts
import { RefreshAllButton } from "./_components/RefreshAllButton";
```

Replace the `action={…}` prop of `<AdminHeader>` with:

```tsx
        action={
          <div className="flex items-start gap-2">
            <RefreshAllButton />
            <ButtonLink href="/admin/sources/new" size="md" className=""><IconPlus size={15} /> Add source</ButtonLink>
          </div>
        }
```

In the "Last result" cell, append the enriched count after the flagged part:

```tsx
                        {run ? `${run.found} found · ${run.inserted} new · ${run.updated} updated · ${run.unchanged} same${run.flagged_missing ? ` · ${run.flagged_missing} flagged` : ""}${run.enriched ? ` · ${run.enriched} with details` : ""}` : "—"}
```

- [ ] **Step 10: Typecheck, test, lint**

Run: `npx tsc --noEmit -p . && npm test && npm run lint`
Expected: all clean.

- [ ] **Step 11: Commit**

```bash
git add src/lib/sources/refresh-auth.ts src/lib/sources/refresh-auth.test.ts src/lib/sources/refresh-summary.ts src/lib/sources/refresh-summary.test.ts src/app/admin/sources/_components/RefreshAllButton.tsx src/app/api/cron/refresh-sources/route.ts src/lib/sources/engine.ts src/app/admin/sources/page.tsx
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): refresh all now button using the cron route"
```

---

### Task 7: Source form — kind picker and resolved URLs

**Files:**
- Modify: `src/app/admin/sources/_components/SourceForm.tsx`, `src/app/admin/sources/actions.ts`

**Interfaces:**
- Consumes: `resolveFeedUrl`, `DEFAULT_ATTRIBUTION` (Task 2), `SOURCE_KINDS`, `SOURCE_KIND_LABELS`, `SourceKind` (Task 1).
- Produces: form field `kind`; `saveSource` stores `kind` and the resolved feed URL.

- [ ] **Step 1: Update `sourceSchema` in `src/app/admin/sources/actions.ts`**

Replace the imports of `checkFeedUrl` / `sourceKey` with:

```ts
import { DEFAULT_ATTRIBUTION, resolveFeedUrl } from "@/lib/sources/platforms";
import { SOURCE_KINDS, sourceKey } from "@/lib/sources/types";
```

Replace the whole `const sourceSchema = …;` with:

```ts
const sourceSchema = z
  .object({
    id: optionalId,
    name: z.string().trim().min(2, "Give the source a name").max(80, "Keep the name under 80 characters"),
    kind: z.enum(SOURCE_KINDS, { message: "Pick a source type" }),
    url: z.string().trim().min(1, "Add the feed URL").max(2000, "That URL is too long"),
    default_organiser_id: optionalId,
    default_category_id: optionalId,
    default_tags: z
      .string()
      .max(400)
      .transform((v) =>
        [...new Set(v.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 10),
      )
      .pipe(z.array(z.string().max(30, "Keep each tag under 30 characters"))),
    attribution: z.string().trim().max(200, "Keep attribution under 200 characters").transform((v) => v || null),
    permission_confirmed: z.boolean(),
    permission_note: z.string().trim().max(1000, "Keep the note under 1000 characters").transform((v) => v || null),
    enabled: z.boolean(),
  })
  .transform((s, ctx) => {
    const resolved = resolveFeedUrl(s.kind, s.url);
    if (!resolved.ok) {
      ctx.addIssue({ code: "custom", message: resolved.error, path: ["url"] });
      return z.NEVER;
    }
    return { ...s, url: resolved.url, attribution: s.attribution ?? DEFAULT_ATTRIBUTION[s.kind] ?? null };
  })
  .refine((s) => !s.enabled || (s.permission_confirmed && s.permission_note), {
    message: "Confirm you have permission to use this feed, and note who granted it, before enabling it.",
    path: ["enabled"],
  });
```

In `saveSource`'s `safeParse({ … })` add after `name:`:

```ts
    kind: formData.get("kind") ?? "ical",
```

- [ ] **Step 2: Update `src/app/admin/sources/_components/SourceForm.tsx`**

Add imports:

```ts
import { SOURCE_KINDS, SOURCE_KIND_LABELS, type EventSource, type SourceKind } from "@/lib/sources/types";
```

(replace the existing `import type { EventSource } …` line).

Above the component add:

```ts
const URL_COPY: Record<SourceKind, { label: string; hint: string; placeholder: string }> = {
  ical: {
    label: "iCal feed URL",
    hint: "An .ics link the owner has said we can use. webcal:// links work too.",
    placeholder: "https://…/calendar.ics",
  },
  luma: {
    label: "Luma iCal link",
    hint: "On the Luma calendar page: Subscribe → Add iCal Subscription → copy the link (webcal://api.lu.ma/ics/…).",
    placeholder: "webcal://api.lu.ma/ics/get?entity=calendar&id=cal-…",
  },
  meetup: {
    label: "Meetup group link",
    hint: "The group's page, e.g. https://www.meetup.com/your-group/. ORBIT finds its calendar feed.",
    placeholder: "https://www.meetup.com/your-group/",
  },
};
```

Inside the component add state:

```ts
  const [kind, setKind] = useState<SourceKind>(source?.kind ?? "ical");
  const copy = URL_COPY[kind];
```

Replace the existing URL `<Field>` with:

```tsx
        <Field label="Type" htmlFor="kind" hint="Luma and Meetup sources link each event back to its page there.">
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
            {SOURCE_KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label={copy.label} htmlFor="url" required hint={copy.hint}>
          <Input id="url" name="url" type="text" inputMode="url" required placeholder={copy.placeholder} defaultValue={source?.url ?? ""} />
        </Field>
```

Change the attribution placeholder to follow the kind:

```tsx
          <Input id="attribution" name="attribution" maxLength={200} placeholder={kind === "ical" ? "Events from Imperial Careers Service" : `Leave empty for “From ${kind === "luma" ? "Luma" : "Meetup"}”`} defaultValue={source?.attribution ?? ""} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p . && npm run lint`
Expected: clean.

- [ ] **Step 4: Check it in the browser**

Run `npm run dev`, sign in with the Dev sign-in "Admin" button on `/login`, open `/admin/sources/new`:
- Type "Meetup group", URL `meetup.com/pydata-london-meetup`, name "PyData London", save. Expected: list shows host `www.meetup.com`; edit page shows `https://www.meetup.com/pydata-london-meetup/events/ical/` and attribution "From Meetup".
- Type "Luma calendar", URL `https://lu.ma/dwebyvr`. Expected: error "That's a Luma page, not its feed. Paste the calendar's Subscribe → iCal link instead."
- Type "Luma calendar", URL `webcal://api.lu.ma/ics/get?entity=calendar&id=cal-7iVMZ4JmmJwQtYl`, name "DWeb Vancouver", tick permission, note "Test source", enable, save. Expected: saved and enabled.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/sources/_components/SourceForm.tsx src/app/admin/sources/actions.ts
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): pick luma or meetup when adding a source"
```

---

### Task 8: Imported events — details editor (fallback)

**Files:**
- Create: `src/lib/sources/details-schema.ts`, `src/lib/sources/details-schema.test.ts`, `src/app/admin/sources/_components/ImportedEventRow.tsx`
- Modify: `src/lib/sources/queries.ts`, `src/app/admin/sources/actions.ts`, `src/app/admin/sources/page.tsx`

**Interfaces:**
- Consumes: `importRemoteImage` (Task 5), `uploadImage` (`@/lib/storage`, client), `sourceKey`, `sourceIdFromKey`, `SourceEventDetails`.
- Produces: `importedDetailsSchema`; `type ImportedEvent`; `listImportedEvents()`; server actions `saveImportedDetails`, `retryPageDetails`; `<ImportedEventRow event action retry />`.

- [ ] **Step 1: Write failing tests** — `src/lib/sources/details-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { importedDetailsSchema } from "./details-schema";

const base = {
  id: "8f6b2a8e-1d3c-4b5a-9e7f-0a1b2c3d4e5f",
  image_url: "",
  cover_url: "",
  description: "",
  price_min: "",
  price_max: "",
};

describe("importedDetailsSchema", () => {
  it("turns empty fields into nulls", () => {
    expect(importedDetailsSchema.parse(base)).toEqual({
      id: base.id, image_url: null, cover_url: null, description: null, price_min: null, price_max: null,
    });
  });

  it("accepts https image links, text and prices", () => {
    const parsed = importedDetailsSchema.parse({
      ...base, image_url: "https://cdn.lu.ma/x.jpg", description: "  Hello  ", price_min: "0", price_max: "12.50",
    });
    expect(parsed).toMatchObject({ image_url: "https://cdn.lu.ma/x.jpg", description: "Hello", price_min: 0, price_max: 12.5 });
  });

  it.each([
    [{ image_url: "http://cdn.lu.ma/x.jpg" }, "Image links must start with https://"],
    [{ cover_url: "javascript:alert(1)" }, "Image links must start with https://"],
    [{ description: "x".repeat(5001) }, "Keep the description under 5,000 characters"],
    [{ price_min: "-1" }, "Prices can't be negative"],
    [{ price_min: "abc" }, "Prices must be numbers"],
    [{ price_min: "10", price_max: "5" }, "“Price to” must be at least “Price from”."],
  ])("rejects %o", (over, message) => {
    const result = importedDetailsSchema.safeParse({ ...base, ...over });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/sources/details-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/sources/details-schema.ts`**

```ts
// Validation for the admin "Details" editor on imported events.

import { z } from "zod";

const httpsImage = z
  .string()
  .trim()
  .max(2000, "That image link is too long")
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\//i.test(v), "Image links must start with https://");

const money = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Prices must be numbers")
  .refine((v) => v === null || v >= 0, "Prices can't be negative")
  .refine((v) => v === null || v <= 100_000, "That price is too high");

export const importedDetailsSchema = z
  .object({
    id: z.uuid({ message: "Unknown event" }),
    /** A link to copy into Cloudinary (pasted from the Luma/Meetup page). */
    image_url: httpsImage,
    /** An image the admin already uploaded with uploadImage(). */
    cover_url: httpsImage,
    description: z.string().trim().max(5000, "Keep the description under 5,000 characters").transform((v) => v || null),
    price_min: money,
    price_max: money,
  })
  .refine((d) => d.price_min === null || d.price_max === null || d.price_max >= d.price_min, {
    message: "“Price to” must be at least “Price from”.",
    path: ["price_max"],
  });

export type ImportedDetailsInput = z.infer<typeof importedDetailsSchema>;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/sources/details-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `listImportedEvents` to `src/lib/sources/queries.ts`**

Change the types import to:

```ts
import type { EventSource, SourceEventDetails, SourceRun } from "./types";
import { sourceIdFromKey, sourceKey } from "./types";
```

Append:

```ts
// ─── Imported Luma / Meetup events (details editor) ───────────────────────

export type ImportedEvent = {
  id: string;
  title: string;
  starts_at: string;
  cover_url: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  external_url: string | null;
  source: string;
  source_event_id: string | null;
  details: Pick<SourceEventDetails, "status" | "attempts" | "last_error" | "fetched_at"> | null;
};

/** Upcoming published events from Luma / Meetup sources; ones without a cover first. */
export async function listImportedEvents({ limit = 60 }: { limit?: number } = {}) {
  const supabase = await createClient();
  const { data: sources } = await supabase.from("event_sources").select("id").in("kind", ["luma", "meetup"]);
  const keys = ((sources ?? []) as { id: string }[]).map((s) => sourceKey(s.id));
  if (keys.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, cover_url, description, price_min, price_max, external_url, source, source_event_id, details:source_event_details ( status, attempts, last_error, fetched_at )",
    )
    .in("source", keys)
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (Omit<ImportedEvent, "details"> & { details: ImportedEvent["details"] | ImportedEvent["details"][] })[];
  return rows
    .map<ImportedEvent>((r) => ({ ...r, details: Array.isArray(r.details) ? (r.details[0] ?? null) : r.details }))
    .sort((a, b) => Number(Boolean(a.cover_url)) - Number(Boolean(b.cover_url)));
}
```

- [ ] **Step 6: Add the two server actions to `src/app/admin/sources/actions.ts`**

Add imports:

```ts
import { importRemoteImage } from "@/lib/sources/cloudinary-import";
import { importedDetailsSchema } from "@/lib/sources/details-schema";
import { sourceIdFromKey } from "@/lib/sources/types";
```

(merge `sourceIdFromKey` into the existing `@/lib/sources/types` import instead of a second import line).

Append:

```ts
const IMPORTED_KINDS = new Set(["luma", "meetup"]);

/** Admin fallback for imported events: cover (pasted link or upload), description, price. */
export async function saveImportedDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = importedDetailsSchema.safeParse({
    id: formData.get("id") ?? "",
    image_url: formData.get("image_url") ?? "",
    cover_url: formData.get("cover_url") ?? "",
    description: formData.get("description") ?? "",
    price_min: formData.get("price_min") ?? "",
    price_max: formData.get("price_max") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, image_url, cover_url, description, price_min, price_max } = parsed.data;

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, source").eq("id", id).maybeSingle();
  if (!event) return { ok: false, error: "That event no longer exists." };
  const sourceId = sourceIdFromKey(event.source as string);
  const { data: source } = sourceId
    ? await supabase.from("event_sources").select("kind").eq("id", sourceId).maybeSingle()
    : { data: null };
  if (!source || !IMPORTED_KINDS.has(source.kind as string)) {
    return { ok: false, error: "Only Luma and Meetup events can be edited here." };
  }

  let cover = cover_url;
  if (image_url) {
    try {
      cover = await importRemoteImage(image_url, `orbit/event-covers/${admin.id}`);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't import that image." };
    }
  }

  const patch: Record<string, unknown> = { description, price_min, price_max };
  if (price_min !== null) patch.currency = "GBP";
  if (cover) patch.cover_url = cover;
  const { error } = await supabase.from("events").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

/** Lets the next refresh read this event's page again. */
export async function retryPageDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown event" };
  const supabase = await createClient();
  const { error } = await supabase.from("source_event_details").delete().eq("event_id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, message: "Will try again on the next refresh." };
}
```

- [ ] **Step 7: Create `src/app/admin/sources/_components/ImportedEventRow.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { uploadImage } from "@/lib/storage";
import type { ImportedEvent } from "@/lib/sources/queries";
import type { ActionState } from "../actions";
import { ActionButton } from "./ActionButton";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS = {
  ok: { tone: "success", text: "Details read" },
  failed: { tone: "warning", text: "Details failed" },
  blocked: { tone: "danger", text: "Blocked by Luma" },
} as const;

export function ImportedEventRow({ event, action, retry }: { event: ImportedEvent; action: Action; retry: Action }) {
  const [state, formAction] = useActionState(action, null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const preview = uploaded ?? event.cover_url;
  const status = event.details ? STATUS[event.details.status] : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      setUploaded(await uploadImage("event-covers", file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <details className="glass rounded-[20px] p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{event.title}</span>
        <span className="text-xs text-muted">{when(event.starts_at)}</span>
        {!event.cover_url && <Badge tone="warning">No cover</Badge>}
        {status ? <Badge tone={status.tone}>{status.text}</Badge> : <Badge>Not read yet</Badge>}
      </summary>

      <div className="mt-4 grid gap-5 md:grid-cols-[12rem_1fr]">
        <div className="space-y-2">
          <div className="aspect-[2/1] overflow-hidden rounded-xl border border-line bg-ink/[0.04]">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          {event.external_url && (
            <a href={event.external_url} target="_blank" rel="noreferrer" className="block text-xs text-accent hover:underline">
              Open the event page ↗
            </a>
          )}
          {event.details?.last_error && <p className="text-xs text-red-300">{event.details.last_error}</p>}
          {event.details && event.details.status !== "ok" && (
            <ActionButton action={retry} fields={{ id: event.id }} variant="ghost" pendingText="…">Try again</ActionButton>
          )}
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="cover_url" value={uploaded ?? ""} />
          <Field label="Image link" htmlFor={`img-${event.id}`} hint="On the event page: right-click the cover → Copy image address, then paste. ORBIT keeps its own copy.">
            <Input id={`img-${event.id}`} name="image_url" type="text" inputMode="url" placeholder="https://cdn.lu.ma/…" />
          </Field>
          <Field label="…or upload an image" htmlFor={`file-${event.id}`} hint={uploading ? "Uploading…" : uploadError ?? "JPG, PNG or WebP, up to 5 MB."}>
            <Input id={`file-${event.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
          <Field label="Description" htmlFor={`desc-${event.id}`}>
            <Textarea id={`desc-${event.id}`} name="description" rows={5} maxLength={5000} defaultValue={event.description ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price from (£)" htmlFor={`pmin-${event.id}`} hint="0 = free. Empty = unknown.">
              <Input id={`pmin-${event.id}`} name="price_min" type="number" min={0} step="0.01" defaultValue={event.price_min ?? ""} />
            </Field>
            <Field label="Price to (£)" htmlFor={`pmax-${event.id}`}>
              <Input id={`pmax-${event.id}`} name="price_max" type="number" min={0} step="0.01" defaultValue={event.price_max ?? ""} />
            </Field>
          </div>
          <FormMessage state={state} />
          <SubmitButton disabled={uploading}>Save details</SubmitButton>
        </form>
      </div>
    </details>
  );
}
```

- [ ] **Step 8: Add the section to `src/app/admin/sources/page.tsx`**

Extend imports:

```ts
import {
  eventCountsBySource, latestRunBySource, listHiddenDuplicates, listImportedEvents, listRecentRuns, listReviewQueue, listSources, sourceLabels,
} from "@/lib/sources/queries";
import { ImportedEventRow } from "./_components/ImportedEventRow";
import { deleteSource, resolveReview, retryPageDetails, runSourceNow, saveImportedDetails, setSourceEnabled } from "./actions";
```

Add `listImportedEvents()` to the `Promise.all` and destructure it as `imported`:

```ts
  const [latest, counts, runs, queue, hidden, labels, imported] = await Promise.all([
    latestRunBySource(ids), eventCountsBySource(ids), listRecentRuns({ limit: 15 }), listReviewQueue(),
    listHiddenDuplicates(), sourceLabels(), listImportedEvents(),
  ]);
```

Insert this section between the Feeds section and the Review queue section:

```tsx
      {imported.length > 0 && (
        <section aria-labelledby="imported-h" className="mt-10 space-y-4">
          <h2 id="imported-h" className="text-base font-semibold tracking-tight">
            Imported events{" "}
            {imported.some((e) => !e.cover_url) && (
              <Badge tone="warning" className="ml-1 align-middle">{imported.filter((e) => !e.cover_url).length} without cover</Badge>
            )}
          </h2>
          <p className="text-sm text-muted">
            Upcoming Luma and Meetup events. Luma covers and descriptions are read automatically; fill in anything missing here.
            The nightly refresh never overwrites what you save.
          </p>
          <ul className="space-y-3">
            {imported.map((e) => (
              <li key={e.id}><ImportedEventRow event={e} action={saveImportedDetails} retry={retryPageDetails} /></li>
            ))}
          </ul>
        </section>
      )}
```

- [ ] **Step 9: Typecheck, test, lint**

Run: `npx tsc --noEmit -p . && npm test && npm run lint`
Expected: all clean. (If ESLint flags `<img>` with `@next/next/no-img-element`, match how `src/components/events/EventCover.tsx` handles it — copy its eslint-disable comment line if it has one, otherwise keep `<img>` since Cloudinary URLs are already sized.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/sources/details-schema.ts src/lib/sources/details-schema.test.ts src/lib/sources/queries.ts src/app/admin/sources/actions.ts src/app/admin/sources/_components/ImportedEventRow.tsx src/app/admin/sources/page.tsx
git -c user.name="Akshat" -c user.email="akshatg9536@gmail.com" commit -m "feat(sources): details editor for imported luma and meetup events"
```

---

### Task 9: End-to-end check and Meetup feed confirmation

**Files:** none changed unless a check fails (then fix in the owning task's files and commit `fix(sources): …`).

- [ ] **Step 1: Full gate**

Run: `npm test && npm run lint && npm run build`
Expected: all pass; build has no "uncached or runtime data during prerendering" error.

- [ ] **Step 2: Real Luma run**

With `npm run dev` running and signed in as Admin (Dev sign-in), on `/admin/sources` (the "DWeb Vancouver" Luma source from Task 7 enabled) click **Refresh all now**.
Expected:
- Button shows "Refreshing…", then a line like `N sources · 1 new · … · 1 with page details` (the feed has one upcoming event, 2026-10-28).
- "Imported events" lists "Open By Design: Tools for Participation…" with "Details read". If Cloudinary env vars are set locally it has a cover; otherwise it shows "Details failed" with "Image import needs Cloudinary…" and the description is still filled.
- `/events/<id>` for that event shows the description and a "Register on Luma" button linking to `https://luma.com/58wdnop2`.
- Click **Refresh all now** again: `0 new`, `0 with page details` (each page is read once).

Check the DB:
```bash
docker exec supabase_db_orbit psql -U postgres -Atc "select e.title, d.status, d.attempts, (e.cover_url is not null) as has_cover, length(e.description) from events e join source_event_details d on d.event_id = e.id;"
```
Expected: one row, `ok` (or `failed` without Cloudinary), attempts `1`, description length > 100.

- [ ] **Step 3: Cron path still works**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/refresh-sources
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/cron/refresh-sources
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $(grep ^CRON_SECRET .env.development.local .env.local 2>/dev/null | head -1 | cut -d= -f2-)" http://localhost:3000/api/cron/refresh-sources
```
Expected: `401`, `401` (no admin session), and `200` (or `500` only if a source failed) when `CRON_SECRET` is set locally; if it isn't set, the third also returns `401` — note it in the report.

- [ ] **Step 4: Meetup feed confirmation (spec risk)**

Find a Meetup group with upcoming events (open `https://www.meetup.com/find/?location=gb--London&source=EVENTS` in a browser and copy a group link), then:

```bash
curl -s -A "ORBIT event sync (+https://orbit.akshatgg.in)" -L "https://www.meetup.com/<group>/events/ical/" | grep -c BEGIN:VEVENT
```

Expected: a number > 0. If it is 0 for a group that clearly has upcoming events, **stop and report**: Meetup no longer fills its feeds, and the Meetup half needs a new decision. If > 0, save a trimmed copy (2–3 events) as `src/lib/sources/__fixtures__/meetup-group.ics`, add a test in `platforms.test.ts` that parses it and checks each event has a `url` on `meetup.com`, and commit `test(sources): meetup feed fixture`.

- [ ] **Step 5: Report**

Summarise: tests/lint/build output, the Luma run numbers, the cron curl results, and the Meetup result.
