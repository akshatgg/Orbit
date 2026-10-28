# Backend cutover F: the frontend talks only to the Orbit API

Sub-plan of the backend repo's `docs/superpowers/plans/2026-10-28-supabase-cutover.md` (section F).
Goal: every Supabase call in `src/` is replaced by a call to the Orbit API (FastAPI), and Supabase
is removed from the frontend: `src/lib/supabase/`, the `@supabase/*` packages and the Supabase env vars.

Branch `feat/backend-cutover-complete` (from `feat/backend-cutover`, rebased on `master`).

## Conventions

- **Server-side only.** Server Components, Server Actions and Route Handlers call the API through
  `src/lib/api/`. The browser never calls the API, except the existing magic-link POST and the
  dev password sign-in (both `credentials: "include"`, so the API sets the session cookie).
- `api.get/post/patch/put/del/raw` (`client.ts`): anonymous calls.
  `apiAs(path)` (`session.ts`): signed-in GET that returns `null` when signed out.
  `authed.get/post/patch/put/del/raw` (`session.ts`): signed-in calls; they throw `ApiError`
  (401 when signed out, 403/404/409/422 with the backend's `detail` code).
- `apiMessage(error, copy)` (`errors.ts`) turns a failed call into the copy the form shows; each
  action keeps the sentences the UI already uses and maps the backend codes to them
  (`organiser_not_approved`, `stripe_not_ready`, `has_registrations`, `ticket_type_has_guests`,
  `event_not_editable`, `event_not_publishable`, `event_not_published`, `date_in_past`,
  `duplicate_date`, …). `isSignedOut/isForbidden/isNotFound/isConflict` for branching.
- Query modules keep their exported names and return types where they can, so pages and
  components change as little as possible. Row types stay in `src/types/database.ts`.
- Authorization lives in the backend; frontend checks (`requireAdmin`, organiser guards) stay as UX.
- The backend writes the admin audit log, sends notifications, releases Cloudinary images and runs
  the importers; the frontend copies of that code are deleted.

## Tasks (one commit each)

1. **API client and session.** `authed` helpers, `apiMessage`, FormData bodies, raw responses.
2. **Auth.** Delete `src/app/auth/callback` and `src/app/auth/confirm` (the API owns
   `/auth/confirm` and `/auth/google/callback`, which redirect to `/login?error=link|auth`).
   Dev sign-in posts to `POST /auth/login`. `/login` explains `?error=auth` too. Sign-out
   clears the host-only and the shared-domain cookie.
3. **Crons.** `src/app/api/cron/{reminders,refresh-sources}` forward to `/api/cron/*` with the
   same `CRON_SECRET` bearer (POST: the admin's session). `vercel.json` unchanged.
4. **Storage.** `uploadImage` gets its signature from `POST /uploads/sign` through a server action;
   503 → "Image uploads aren't configured"; no Supabase Storage fallback.
   Delete `src/app/api/uploads/sign` and `src/lib/cloudinary-release.ts`.
5. **Attendee, discovery, profile, tickets, SEO.** `src/lib/{events,tickets,discovery,profile,actions,seo}`,
   `onboarding`, `profile/preferences`: `/events*`, `/feed/*`, `/discovery/*`, `/me/*`,
   `/events/{id}/registrations`, `/events/{id}/marks/{kind}`, `/organisers/{id}/follow`, `/public/*`.
6. **Organiser studio.** `src/lib/{organiser,guests}`, studio pages and actions, `join/[code]`:
   `/organiser/events*` (W2: diff-synced children with ids, `/dates`, error codes), `/organisers/*`,
   `/invites/{code}`.
7. **Payments.** Checkout via `/payments/registrations/{id}/checkout` and `/me/tickets/{id}/checkout`,
   `/checkout/success`, Connect via `/payments/connect/*`. Delete the frontend Stripe webhook,
   fulfilment and Connect logic.
8. **Notifications and push.** `/me/notification-preferences`, `/push/subscriptions`, `/push/test`.
   Delete `src/lib/notifications/{index,deliver,channels,reminders}.ts`.
9. **Admin.** `/admin/*` for overview, events (incl. W6 `series_dates`, `/admin/events/sources`),
   users, organisers (W6 members), categories, import, sources and review. Delete the source engine
   (`src/lib/sources` connectors, engine, enrichment) and the tests that only covered it.
10. **Removal.** Delete `src/lib/supabase/`, Supabase scripts and packages, rename the generated
    row types, update `.env.example` and `docs/ARCHITECTURE.md`. `grep -ri supabase src package.json`
    is empty. The top-level `supabase/` migrations folder stays until Akshat decides.

## Verification

- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Run the app on :3010 against a local API on :8110 loaded with the production copy
  (`seeds/prod.sql`), in light and dark themes and at 390px: dev password sign-in, feed, search,
  event page, save/dismiss, register + cancel, profile + edit + preferences, onboarding, organiser
  dashboard/create/edit with tickets/publish/add dates/cancel, guest list + check-in, join invite,
  admin overview/events/users/organisers/categories/sources/review/import, cover upload (expects the
  "not configured" path without Cloudinary keys).
