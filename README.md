<div align="center">

<img src="public/brand/orbit-logo-full.png" alt="ORBIT — Explore Opportunities" width="420" />

### Career events, networking, socials and society nights — all in one place, ranked for you.

**[orbit.akshatgg.in](https://orbit.akshatgg.in)** · Installable on iPhone & Android · No app store needed

![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/Orbit_API-FastAPI-009688?logo=fastapi&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe_Connect-635BFF?logo=stripe&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## What is ORBIT?

Students miss great opportunities because events are scattered across university portals, society
pages, careers platforms, ticketing sites and inboxes. **ORBIT brings them into one feed and ranks them
for each person** — career goals, interests, course and free time — with a clear
*"Recommended because…"* on every pick.

It's two-sided, like Luma or Eventbrite: **students** discover and register, **organisers** (societies,
university teams, employers, communities) publish and run events, and **admins** keep it trustworthy.
ORBIT launches with Imperial College Business School MSc students.

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/onboarding.png" width="200" /><br /><sub>Onboarding</sub></td>
    <td align="center"><img src="docs/screenshots/for-you.png" width="200" /><br /><sub>For You feed</sub></td>
    <td align="center"><img src="docs/screenshots/event.png" width="200" /><br /><sub>Event page</sub></td>
    <td align="center"><img src="docs/screenshots/ticket.png" width="200" /><br /><sub>QR ticket</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/interests.png" width="200" /><br /><sub>Interests</sub></td>
    <td align="center"><img src="docs/screenshots/explore.png" width="200" /><br /><sub>Explore & search</sub></td>
    <td align="center"><img src="docs/screenshots/organiser-event.png" width="200" /><br /><sub>Organiser studio</sub></td>
    <td align="center"><sub>…and more in the app</sub></td>
  </tr>
</table>

<p align="center"><img src="docs/screenshots/admin.png" width="820" /><br /><sub>Admin dashboard</sub></p>

## Features

### For students
- **Personalised onboarding** — university, course, career and personal interests, formats, weekly availability.
- **For You feed** — transparent rule-based ranking with a reason on every card; hide anything with *Not interested*.
- **This Week** — top picks plus Career & academic, Social & community and Other interests.
- **Calendar** — month view of saved and registered events, with `.ics` export.
- **Explore** — full-text search with filters for date, category, career interest, format, price and location.
- **Event pages** — cover, organiser, venue & map, spots left, share, add to calendar.
- **Registration** — free tickets, paid tickets, application forms with questions, waitlists, or *Apply now* to the organiser's own site.
- **My Tickets** — scannable QR pass for every event you're going to.
- **Follow organisers**, save events, and get **push & email reminders** before events and deadlines.

### For organisers
- **Apply once** → approved by an ORBIT admin → publish freely.
- **Event studio** — 5-step editor; per event choose **free tickets**, **paid tickets** (paid straight to the organiser's own Stripe account), an **application form** with approve/decline, an **external link**, or **info only**.
- **Guest list** — approvals, search, CSV export.
- **Door check-in** — scan QR tickets with the phone camera (or type the code / search by name).
- **Stats** — views, Apply-now clicks, registrations, conversion and check-ins.
- **Public organiser page** with followers, and a team of co-organisers.

### For admins
- **Overview** with key numbers and a *Needs attention* queue.
- **Approve / reject / suspend organisers** and award the ✓ verified badge.
- **Moderate events** — feature, cancel, remove, restore; add events manually.
- **Users & admins** — the super admin adds or removes admins.
- **CSV import**, **categories**, an **audit log** of admin actions.
- **Approved event sources** — permission-checked iCal feeds, automatic refresh, duplicate detection.

### Platform
- **PWA** — installs to the home screen on iOS and Android, works full-screen, has an offline screen.
- **Security by default** — the app holds no database or third-party secrets; the Orbit API checks
  every call, registrations, approvals and check-ins run through audited SQL functions, and organisers
  can only see their own guests.
- **Compliance-first data** — no scraping; every event keeps its source and provenance.

## Install the app (PWA)

| Device | Steps |
|---|---|
| **Android** (Chrome) | Open [orbit.akshatgg.in](https://orbit.akshatgg.in) → **Install app** (or ⋮ → *Install app*) |
| **iPhone** (Safari) | Open [orbit.akshatgg.in](https://orbit.akshatgg.in) → **Share** → **Add to Home Screen** |
| **Desktop** (Chrome / Edge) | Click the install icon in the address bar |

Push notifications on iPhone need iOS 16.4+ and the app opened from the home screen.

## Tech stack

| Layer | Choice |
|---|---|
| App | [Next.js 16](https://nextjs.org) (App Router, Cache Components, Server Actions) · React 19 · TypeScript |
| Styling | Tailwind CSS 4 with a design system drawn from the ORBIT logo |
| Data & auth | Orbit API (FastAPI + Postgres, separate repo) — accounts (Google + email link), data, payments, uploads, notifications and event importers |
| Images | Cloudinary signed uploads (signature from the Orbit API) |
| Payments | Stripe Connect (Express, destination charges) |
| Notifications | Web Push (VAPID) · email, both sent by the Orbit API |
| Hosting | [Vercel](https://vercel.com) with daily cron jobs |
| Testing | Vitest · ESLint · TypeScript strict |

## Getting started

**Prerequisites:** Node.js 22+ and a running Orbit API (the backend repo; it brings its own
Postgres in Docker).

```bash
git clone https://github.com/akshatgg/Orbit.git
cd Orbit
npm install
```

Create `.env.development.local`:

```bash
BACKEND_URL=http://localhost:8090
NEXT_PUBLIC_BACKEND_URL=http://localhost:8090
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_LOGIN=1
```

```bash
npm run dev          # http://localhost:3000
```

`NEXT_PUBLIC_DEV_LOGIN=1` adds an email + password **Dev sign-in** form to `/login` (local only); it signs
in through the API's `POST /auth/login`. Give an account a password with the API's `POST /auth/password`.
On `localhost` the API's session cookie is shared with the app, so no further setup is needed.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Needed for |
|---|---|
| `BACKEND_URL` | Every server-side call to the Orbit API |
| `NEXT_PUBLIC_BACKEND_URL` | Browser redirects to the API: Google sign-in, email login link |
| `NEXT_PUBLIC_APP_URL` | Canonical URLs, sitemap and share previews |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notifications (the API holds the private key) |
| `CRON_SECRET` | Protects `/api/cron/*`, which forwards to the API's `/api/cron/*` with the same secret |
| `GOOGLE_SITE_VERIFICATION` | Optional Search Console tag |

Email, Stripe, Cloudinary and VAPID private keys are configured on the Orbit API. Every optional
integration degrades gracefully there — without Stripe, paid tickets are switched off; without
Cloudinary, image uploads say they aren't configured.

## Project structure

```
src/
├── app/
│   ├── (auth)/login            Sign in (Google, email link)
│   ├── onboarding/             5-step onboarding
│   ├── (main)/                 Student app with the tab bar
│   │   ├── page.tsx            For You
│   │   ├── week/ calendar/     This Week · Calendar (+ .ics export)
│   │   ├── search/             Explore
│   │   ├── tickets/            My Tickets + QR pass
│   │   └── profile/            Profile & preferences
│   ├── events/[id]/            Public event page + registration
│   ├── go/[id]/                "Apply now" redirect (click tracking)
│   ├── o/[slug]/               Public organiser page
│   ├── organiser/              Organiser studio: apply, events, guests, check-in, settings, payments
│   ├── admin/                  Admin dashboard
│   ├── checkout/               Paid-ticket confirmation
│   └── api/                    Push subscribe · cron forwarders (reminders, source refresh)
├── components/                 UI kit, event cards, feature components
├── lib/                        API client (lib/api), auth, queries, ranking, tickets, payments…
└── types/                      Table row types (the shapes the API returns)
public/sw.js                    Service worker (offline + push)
docs/                           Architecture guide, product notes, screenshots
```

Conventions, the data model and the security rules are documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the product scope is in
[`docs/orbit-product-notes.md`](docs/orbit-product-notes.md).

## Deployment

1. **Orbit API** — deploy the backend first (it owns the database, sign-in, email, push, Stripe,
   Cloudinary and the importers). Its `FRONTEND_URL` is this app's URL, and its session cookie domain is
   the parent domain shared with the app (e.g. `.akshatgg.in`).
2. **Vercel** — import the repo, set `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL` to the API, plus the
   variables above, and deploy. The cron jobs in [`vercel.json`](vercel.json) call `/api/cron/reminders`
   (08:00 UTC) and `/api/cron/refresh-sources` (03:00 UTC), which forward to the API.
3. **Stripe** (optional) — webhooks point at the API: `https://<api-domain>/api/payments/webhook`.

The account with the super-admin email becomes super admin automatically on first sign-in and can
appoint other admins from **Admin → Users & admins**.

## SEO

Signed-out visitors see a public landing page at `/` (the proxy rewrites `/` to `/welcome`; signed-in users keep the For You feed). Event and organiser pages carry `Event` / `Organization` JSON-LD, canonical URLs and Open Graph images, and `/sitemap.xml` and `/robots.txt` are generated by the app. Account, organiser-studio, admin and ticket pages are `noindex`.

Search Console setup:

1. Add `https://orbit.akshatgg.in` as a property at [search.google.com/search-console](https://search.google.com/search-console).
2. Verify ownership either with the HTML tag method (set `GOOGLE_SITE_VERIFICATION` to the tag's `content` value and redeploy) or with a DNS TXT record on the domain.
3. Under Sitemaps, submit `https://orbit.akshatgg.in/sitemap.xml`.
4. Set `NEXT_PUBLIC_APP_URL=https://orbit.akshatgg.in` in production so canonical URLs and the sitemap use the right origin.

## Roadmap

- Sponsored listings and organiser promotions for employers
- University partnerships and multi-university support
- Native store builds (Trusted Web Activity / Capacitor)
- Smarter, learning-based recommendations
