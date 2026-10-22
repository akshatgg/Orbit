# ORBIT — Architecture & conventions

Read this before changing code. Product scope lives in `docs/orbit-product-notes.md`.

## Stack

- **Next.js 16** App Router, TypeScript, **Cache Components on** (`cacheComponents: true`).
  This is NOT the Next.js you know — read `node_modules/next/dist/docs/` when unsure.
  Middleware is called **`proxy.ts`** (`src/proxy.ts`).
- **Tailwind CSS 4** (tokens in `src/app/globals.css`).
- **Supabase**: Postgres + Auth + Storage (buckets kept as the image-upload fallback; images normally live on Cloudinary). Local dev runs in Docker (`npm run db:start`).
- **PWA**: `src/app/manifest.ts` + `public/sw.js`.
- Tests: **Vitest** (`npm test`) for pure logic in `src/**/*.test.ts`.

## Running locally

```bash
npm run db:start        # local Supabase (Docker) — applies migrations + seed
npm run dev             # http://localhost:3000 (uses .env.development.local → local Supabase)
npm test && npm run lint && npm run build
```

`.env.development.local` points `npm run dev` at local Supabase and turns on **Dev sign-in**
buttons on `/login` (one tap as Student / New user / Organiser / Pending org / Admin / Super admin).
All seeded accounts use password `password123`. Seed data: `supabase/seed.sql`.

`.env.local` holds the hosted project's secrets (including `SUPABASE_DB_PASSWORD`, which the
Supabase CLI also picks up — that's why `npm run db:types` passes `--db-url` explicitly).

## Page pattern (Cache Components)

Reading cookies / the session / the database / `params` / `searchParams` must happen **inside a
`<Suspense>` boundary**, never at the top level of a page or layout — otherwise the build fails
("uncached or runtime data during prerendering").

```tsx
// src/app/(main)/example/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id, title").limit(10);
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

- `src/lib/supabase/server.ts` → `createClient()` for Server Components / actions / routes (user's RLS).
- `src/lib/supabase/client.ts` → `createClient()` for Client Components.
- `src/lib/supabase/admin.ts` → `createAdminClient()` bypasses RLS. **Server-only, trusted code only**
  (webhooks, crons, imports). Never use it to skip a permission check you could express in RLS.
- The Supabase client is **untyped** on purpose (feature branches add tables/functions without
  editing a shared generated file). Use the row types from `src/types/database.ts` and cast query
  results: `(data ?? []) as Organiser[]`. Define types for your own new tables in your feature folder.
- `src/lib/auth.ts`: `getCurrentUser`, `getProfile`, `requireUser`, `requireProfile`, `requireAdmin`,
  `requireSuperAdmin`, `isAdmin`, `isSuperAdmin`, `getMyOrganisers`.
- `src/lib/events/queries.ts`: `EVENT_CARD_SELECT`, `EventCardData`, `withCounts`, `spotsLeft`,
  `listUpcomingEvents`, `getEventCard`, `getMyEventState`, `listCategories`.
- `src/lib/actions/user-events.ts`: `toggleSaved`, `dismissEvent`, `setEventMark`, `setFollow`,
  `logInteraction`.
- `src/lib/calendar`: `googleCalendarUrl`, `buildIcs`. `src/lib/format.ts`: dates (UK time), prices.
- `src/lib/taxonomy.ts`: interests, formats, organiser kinds, weekdays, day parts.
- `src/lib/storage.ts`: `uploadImage("event-covers" | "organiser-logos", file)` (client-side). Gets a signature from
  `POST /api/uploads/sign` and uploads straight to Cloudinary (`orbit/<kind>/<user id>/…`); falls back to Supabase
  Storage when Cloudinary env vars are missing. `src/lib/cloudinary.ts`: `signParams`, `cloudinaryUrl` (f_auto/q_auto delivery).

## Database (see `supabase/migrations/`)

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

Registration **writes only go through SQL functions** (RLS blocks direct writes):
`register_for_event(p_event_id, p_ticket_type_id?, p_answers jsonb)`, `cancel_registration(p_event_id)`,
`decide_registration(p_registration_id, 'approve'|'decline')`, `check_in(p_event_id, p_code)` → jsonb
`{result: checked_in|already|not_found|not_going, name, ticket}`, `undo_check_in(p_registration_id)`,
`mark_registration_paid(...)` (service role only). Counts: `event_counts(event_ids uuid[])`.
Admin roles: `set_user_role(target_email, 'admin'|'user')` (super admin only).
Team invites: `create_organiser_invite(org)`, `peek_organiser_invite(code)`, `accept_organiser_invite(code)`.

Rules enforced in the database (don't re-implement, don't bypass):
- New organisers are always `pending`; only admins approve / verify / suspend.
- Only members of an **approved** organiser (or admins) can create events.
- Organisers can't feature or un-remove events. Only the super admin changes roles.
- The super admin is `akshatg9636@gmail.com` (auto-promoted on sign-up; set by `public.super_admin_email()`).

**Adding schema:** create a NEW migration file `supabase/migrations/2026101600XXXX_<feature>.sql`
(use the timestamp assigned to your feature). Never edit existing migrations. Grant table access
explicitly (`grant … to authenticated`) and enable RLS — hosted tables are not auto-exposed.
Apply locally with
`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/<file>.sql`.
**Do not run `npm run db:reset` or stop Supabase** — other people share the local database.

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
| notifications | `src/lib/notifications/**`, `src/components/notifications/**`, `src/app/api/push/**`, `src/app/api/cron/reminders/**`, `public/sw.js` push handlers |
| event-sources | `src/app/admin/sources/**`, `src/app/api/cron/refresh-sources/**`, `src/lib/sources/**` |

Cross-feature hooks (call them; the owning feature implements them):
- `createTicketCheckout(registrationId)` in `src/lib/payments` — event page calls it for paid tickets.
- `notifyEventChanged(eventId, change)` / `notifyRegistrationChanged(id)` in `src/lib/notifications`.
- `<NotificationSettings />` in `src/components/notifications` — rendered on the profile page.

## Git

Commits as `Akshat <akshatg9536@gmail.com>`, Conventional Commits (`feat(scope): …`).
No AI / assistant attribution anywhere — not in commits, PR text, code or comments.
