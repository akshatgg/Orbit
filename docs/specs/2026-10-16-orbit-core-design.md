# ORBIT core app — design (piece 1 of 3)

Source brief: "Product Requirements Brief: Personalised University Event Discovery
Platform" (Swayam M.). ORBIT is a networking and events platform — career, social
and everything else worth attending. Imperial College Business School MSc students
are the launch audience, not the product's identity.

## Build order
1. **Core app** (this doc) — usable with manually entered / CSV-imported events.
2. **Event sources** — source connectors, 48–72h refresh, duplicate removal, stale flags, source status.
3. **Reminders** — Web Push + email (Resend) before saved events and deadlines.

## Platform
PWA on Next.js 16 with a Postgres backend (today the Orbit API), hosted free on `*.vercel.app`. Capacitor wrap later
only if app-store listings are needed. Cost during the pilot: £0.

## Sign-in
Google or email login link, open to anyone. Emails ending `.ac.uk` / `.edu` get
`is_verified_student = true` (set by a database trigger; users can't edit it).

## Onboarding (5 steps, all editable later)
1. University, department, course, year
2. Career interests (consulting, finance, technology, marketing, entrepreneurship, …)
3. Personal interests (fitness, socialising, travel, sustainability, …)
4. Preferred event types + format (in-person / online / hybrid) + location
5. Weekly availability (optional)

## Screens (bottom tab bar)
- **For You** — ranked feed; each card shows a "Recommended because…" line, Save,
  Register (opens original page) and Not interested.
- **This Week** — Top picks, Career & academic, Social & community, Other interests.
- **Calendar** — saved/registered events by day; `.ics` and Google Calendar links.
- **Search** — keyword search over title/organiser/description; filters for date,
  category, format, location, price; sort by relevance, date or deadline.
- **Profile** — preferences; saved, attended and not-interested lists.

ORBIT never claims a booking: "registered" is the user's own mark.

## Ranking (rule-based, transparent)
Score = sum of matched rules:
career-interest match, course/department match, preferred category, preferred
format, fits availability, deadline within 72h (boost). Penalties: dismissed
(hidden), full, cancelled/expired (hidden). The top 1–2 matched rules produce the
"Recommended because…" text. Lives in `src/lib/ranking`, pure functions, unit-tested.

## Admin (`/admin`, role = admin)
Add/edit events; CSV import with row-level preview and errors before saving;
manage categories/tags; mark cancelled/expired.

## Data
Tables: `profiles`, `categories`, `events` (with `source`, `source_url`,
`source_event_id`, `last_verified_at` for provenance), `user_events`
(saved/registered/attended/dismissed). RLS: users see only their own profile and
actions; everyone signed in reads events and categories; only admins write them.
Schema: the Orbit API's Alembic migrations (backend repo).

## Testing
Unit tests for ranking and CSV parsing; one browser test for
onboarding → feed → save; manual PWA install check at phone width.

## Out of scope for piece 1
Automated sources, refresh, duplicate removal (piece 2); push/email reminders
(piece 3); in-app ticketing, social/messaging, AI recommendations.
