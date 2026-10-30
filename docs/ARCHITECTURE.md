# ORBIT — Architecture & conventions

Read this before changing code. Product scope lives in `docs/orbit-product-notes.md`.

## Stack

- **Next.js 16** App Router, TypeScript, **Cache Components on** (`cacheComponents: true`).
  This is NOT the Next.js you know — read `node_modules/next/dist/docs/` when unsure.
  Middleware is called **`proxy.ts`** (`src/proxy.ts`).
- **Tailwind CSS 4** (tokens in `src/app/globals.css`).
- **Orbit API** (FastAPI, separate repo): the only backend. It owns Postgres, sign-in (Google, email link,
  password), email and web push, Stripe, Cloudinary signing and the event importers. This app holds no
  database or third-party secrets.
- **PWA**: `src/app/manifest.ts` + `public/sw.js`.
- Tests: **Vitest** (`npm test`) for pure logic in `src/**/*.test.ts`.

## Running locally

```bash
# in the backend repo: start Postgres + the API (http://localhost:8090)
npm run dev             # http://localhost:3000 (uses .env.development.local → BACKEND_URL)
npm test && npm run lint && npm run build
```

`.env.development.local` sets `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` to the local API and
`NEXT_PUBLIC_DEV_LOGIN=1`, which shows an email + password **Dev sign-in** form on `/login`
(`POST /auth/login`; the API sets the `orbit_session` cookie, shared by every port on `localhost`).

## Page pattern (Cache Components)

Reading cookies / the session / the database / `params` / `searchParams` must happen **inside a
`<Suspense>` boundary**, never at the top level of a page or layout — otherwise the build fails
("uncached or runtime data during prerendering").

```tsx
// src/app/(main)/example/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { apiAs } from "@/lib/api/session";
import { requireProfile } from "@/lib/auth";

export default function Page({ searchParams }: PageProps<"/example">) {
  return (
    <>
      <PageHeader title="Example" subtitle="Static shell renders instantly" />
      <Suspense fallback={<ListSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/example">["searchParams"] }) {
  const profile = await requireProfile();          // redirects if signed out / not onboarded
  const { q } = await searchParams;
  const data = await apiAs<{ items: { id: string; title: string }[] }>("/me/events", { query: { q } });
  return <ul>{/* … */}</ul>;
}
```

- `params` / `searchParams` are **Promises** — pass them down and `await` inside the boundary.
- `export const instant = false` on a page is the escape hatch if a page truly must block.
- Mutations: **Server Actions** in a co-located `actions.ts` with `"use server"`, validate input
  with **zod**, return `{ ok: true } | { ok: false, error }`, then `revalidatePath(...)`.
  Forms use `useActionState` + `<SubmitButton>` + `<FormMessage>`.
- Route handlers (`route.ts`) are fine for redirects, file downloads, webhooks and crons.

## Data access

Everything goes through the Orbit API, **from the server** (Server Components, Server Actions, Route
Handlers). The browser never calls the API, except the email login-link request, the dev password
sign-in and the Google sign-in redirect (`NEXT_PUBLIC_BACKEND_URL`).

- `src/lib/api/client.ts` → `api.get/post/patch/put/del/raw` for anonymous calls (`revalidate` for caching),
  `ApiError` (status + the backend's `detail`).
- `src/lib/api/session.ts` → `apiAs(path)` (signed-in GET, `null` when signed out) and
  `authed.get/post/patch/put/del/raw` (signed-in calls that throw `ApiError`; 401 = signed out). The
  `orbit_session` cookie is forwarded as a bearer token.
- `src/lib/api/errors.ts` → `apiMessage(error, copy)` maps backend codes (`stripe_not_ready`,
  `organiser_not_approved`, …) to the sentence a form shows; `isSignedOut/isForbidden/isNotFound/isConflict`.
- The API enforces every permission; checks in the app (`requireAdmin`, organiser guards) are only UX.
  It also writes the admin audit log, sends notifications and releases Cloudinary images.
- Row types live in `src/types/database.ts` (shapes the API returns); define response types for your
  own endpoints in your feature folder.
- `src/lib/auth.ts`: `getCurrentUser`, `getProfile`, `requireUser`, `requireProfile`, `requireAdmin`,
  `requireSuperAdmin`, `isAdmin`, `isSuperAdmin`, `getMyOrganisers`.
- `src/lib/events/queries.ts`: `EVENT_CARD_SELECT`, `EventCardData`, `withCounts`, `spotsLeft`,
  `listUpcomingEvents`, `getEventCard`, `getMyEventState`, `listCategories`.
- `src/lib/actions/user-events.ts`: `toggleSaved`, `dismissEvent`, `setEventMark`, `setFollow`,
  `logInteraction`.
- `src/lib/calendar`: `googleCalendarUrl`, `buildIcs`. `src/lib/format.ts`: dates (UK time), prices.
- `src/lib/taxonomy.ts`: interests, formats, organiser kinds, weekdays, day parts.
- `src/lib/storage.ts`: `uploadImage("event-covers" | "organiser-logos", file)` (client-side). Gets a signature from
  the API's `POST /uploads/sign` through a server action and uploads straight to Cloudinary
  (`orbit/<kind>/<user id>/…`); when the API has no Cloudinary keys, uploads report that they aren't configured. `uploadChatAttachment("image" | "doc", file)` does the same for files in a chat (`orbit/chat/<user id>/…`; PDFs go up as `raw`). `src/lib/cloudinary.ts`: `signParams`, `cloudinaryUrl` (f_auto/q_auto delivery).

## Communities and channels

A community (`kind: "community"`) holds channels (`kind: "channel"`, `parent_slug`). `/communities/[slug]` is its home; a
community with no channels keeps the older page, and a channel's old address redirects to `/communities/[slug]/[channel]`.
`/communities` goes straight to the community when there's only one (not for someone who can create one).
An Orbit admin or the team of an approved organisation creates one at `/communities/new` (it starts with Announcements and the
channels picked there); the organisation's team then manages it, and Studio links to it and offers to share each newly published
event in its channels. `ChatThread` is shared by channels, circles and DMs,
and so is `LibraryPanel` (Media / Links / Docs, on a channel's `info` page and at `/messages/[id]/library`).

## Data model (owned by the Orbit API)

The schema, its migrations and the SQL functions live in the backend repo. The tables the app reads
through the API:

| Table | What |
|---|---|
| `profiles` | one per user; `role` = `user` / `admin` / `super_admin`; onboarding answers |
| `organisers`, `organiser_members` | societies / employers / university teams; `status` pending→approved |
| `categories` | event categories (`group` = career / social / other) |
| `events` | `registration_mode` = `tickets` / `external` / `none`; `status` = draft / published / cancelled / expired / removed |
| `event_private` | online link / guest info — visible to confirmed guests + organisers only |
| `ticket_types`, `event_questions` | per-event tickets (price 0 = free) and application questions |
| `registrations` | one per user per event; status going / pending / waitlisted / awaiting_payment / declined / cancelled; `qr_code` |
| `user_events` | saved / dismissed / external_registered / attended marks |
| `follows` | user follows organiser |
| `event_interactions` | analytics: view / apply_click / share / calendar_add |
| `organiser_invites` | team invite links (owner creates once the organiser is approved; `/join/<code>` accepts) |

Rules the API enforces (don't re-implement, don't work around):
- New organisers are always `pending`; only admins approve / verify / suspend.
- Only members of an **approved** organiser (or admins) can create and publish events; paid tickets need
  the organiser's Stripe account to accept charges.
- Organisers can't feature or un-remove events. Only the super admin changes roles.
- Registrations, approvals and check-ins go through the API's registration endpoints, never direct writes.

## Sign-up flow

`/onboarding` asks **What brings you to ORBIT?** (goals `career` / `network` / `social` / `host`) and the rest
follows from the answer. Routing lives in `src/lib/profile/flow.ts` (`stepsFor`, `landingPath`, `safeNextPath`):
Explorer goals → which describes you (student / graduate / professional / other), interests, event types,
availability; `host` adds the organisation application; host-only skips every interest question. Hosts land on
`/organiser`; `?next=` returns people to a ticket. Until an admin approves an organisation, Studio shows only its
review status (the database already blocks creating events). The `profiles` columns are `goals`, `user_type`,
`graduation_year`, `company`, `industry`, `job_title`, `host_role`. Ranking only uses university / course for
students and graduates (`src/lib/ranking`).

## Design: two themes

`html[data-theme="dark"|"light"]`, set before paint by the inline script in `src/components/theme/theme.ts`
(preference in `localStorage["orbit-theme"]`: system / light / dark; "system" is shown as **Auto**: light from
7:00 to 19:00 on the device's clock, dark otherwise, switching by itself). Dark is "Clear glass", light is "Daylight".
The logo is one image everywhere: `<OrbitLogo>` (`src/components/brand/OrbitLogo.tsx`, file `LOGO_SRC` in
`src/lib/brand.ts`); its black centre is fully opaque so it never looks grey on the light theme.
Typeface: Instrument Sans (`font-sans` and `font-display`).

- Tokens (`globals.css`): `bg-bg`, `bg-surface`, `border-line`, `text-fg`, `text-muted`, `text-subtle`, `text-accent`
  (blue), `text-orange` (deadlines), and `ink` for adaptive alpha tints: `bg-ink/[0.06]`, `border-ink/10`.
  Never hard-code white/black alphas except on top of photos.
- Primary fill is `bg-gradient text-bg` (kept class name): white in dark, solid blue in light.
- `glass` = card surface (tinted in dark, white with soft shadow in light, no blur). `glass-strong` = real frosted
  glass for things that float (tab bar, sticky CTA, sheets). `glass-float` / `round-btn` = round buttons on photos.
- Use the `light:` / `dark:` variants when the themes differ in structure (For You hero and list, event page).
- No ambient orbs, gradient text, glows or tracked all-caps eyebrows.

## Feature ownership

Each feature only creates/edits files it owns, so PRs merge in any order without conflicts.
Shared files (layouts, nav, `ui/`, `lib/auth.ts`, `lib/events/queries.ts`, `package.json`,
`globals.css`, existing migrations, `src/types/*`) are **read-only** for features. If you need a
shared component, build it inside your own folder.

| Feature | Owns |
|---|---|
| onboarding-profile | `src/app/onboarding/**`, `src/app/(main)/profile/**`, `src/lib/profile/**`, `src/components/profile/**` |
| discovery | `src/app/(main)/page.tsx`, `src/app/(main)/week/**`, `src/app/(main)/calendar/**`, `src/app/(main)/search/**`, `src/lib/ranking/**`, `src/lib/discovery/**`, `src/components/discovery/**` |
| event-tickets | `src/app/events/**`, `src/app/go/**`, `src/app/(main)/tickets/**`, `src/lib/tickets/**`, `src/components/tickets/**` |
| organiser-studio | `src/app/(main)/organiser/page.tsx`, `src/app/(main)/organiser/apply/**`, `src/app/(main)/organiser/settings/page.tsx` (+ new non-payments subroutes), `src/app/(main)/organiser/events/new/**`, `src/app/(main)/organiser/events/[id]/edit/**`, `src/app/o/**`, `src/lib/organiser/**`, `src/components/organiser/**` |
| organiser-guests | `src/app/(main)/organiser/events/[id]/page.tsx`, `…/[id]/guests/**`, `…/[id]/check-in/**`, `…/[id]/actions.ts`, `src/lib/guests/**`, `src/components/guests/**` |
| payments | `src/app/(main)/organiser/settings/payments/**`, `src/app/api/stripe/**`, `src/app/checkout/**`, `src/lib/payments/**`, `src/components/payments/**` |
| admin | `src/app/admin/**` (except `sources`), `src/lib/admin/**`, `src/components/admin/**` |
| notifications | `src/lib/notifications/**`, `src/components/notifications/**`, `src/app/api/push/**`, `public/sw.js` push handlers |
| event-sources | `src/app/admin/sources/**`, `src/lib/sources/**` |
| api | `src/lib/api/**`, `src/lib/cron/**`, `src/app/api/cron/**` (forwarders to the API) |

Cross-feature hooks (call them; the owning feature implements them):
- `createTicketCheckout(registrationId)` in `src/lib/payments` — event page calls it for paid tickets.
- `<NotificationSettings />` in `src/components/notifications` — rendered on the profile page.

## Git

Commits as `Akshat <akshatg9536@gmail.com>`, Conventional Commits (`feat(scope): …`).
No AI / assistant attribution anywhere — not in commits, PR text, code or comments.
