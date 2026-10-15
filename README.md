# ORBIT — Explore Opportunities

Personalised discovery for career, networking and social events. Installable on
iOS and Android as a PWA (Progressive Web App) — no app store needed.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres, Auth, Storage) · Vercel (free `*.vercel.app` hosting).

## Getting started

1. Create a Supabase project (region: London `eu-west-2`).
2. Paste its URL and keys into `.env.local` (see `.env.example` for every variable).
3. In the Supabase SQL editor, run `supabase/migrations/20261016000000_init.sql`,
   then `supabase/seed.sql`.
4. In Supabase → Authentication → URL Configuration, add
   `http://localhost:3000/auth/callback` (and later your `.vercel.app` URL) to the redirect URLs.
5. `npm install` then `npm run dev` → http://localhost:3000

Make yourself an admin (SQL editor):
`update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

## Folder structure

```
orbit/
├── public/
│   ├── sw.js                  # service worker: offline screen + push notifications
│   ├── icons/                 # PWA icons (192, 512, maskable, apple-touch)
│   └── brand/                 # logo files
├── supabase/
│   ├── migrations/            # database schema + security rules (RLS)
│   └── seed.sql               # starter event categories
├── docs/specs/                # design docs
└── src/
    ├── proxy.ts               # refreshes login session, guards pages
    ├── app/
    │   ├── layout.tsx         # fonts, theme, PWA meta, service worker
    │   ├── manifest.ts        # makes the app installable
    │   ├── (auth)/login/      # Google + email-link sign-in
    │   ├── auth/callback/     # finishes sign-in
    │   ├── onboarding/        # 5-step preferences
    │   ├── (main)/            # screens with the bottom tab bar
    │   │   ├── page.tsx       #   For You (ranked feed)
    │   │   ├── week/          #   This Week
    │   │   ├── calendar/      #   Calendar
    │   │   ├── search/        #   Search + filters
    │   │   └── profile/       #   Profile + saved events
    │   ├── events/[id]/       # event details
    │   ├── admin/             # admin: events, CSV import, categories
    │   └── offline/           # shown when there's no connection
    ├── components/            # nav/, ui/, events/, pwa/
    ├── lib/
    │   ├── supabase/          # browser, server, admin clients + proxy helper
    │   ├── ranking/           # rule-based scoring + "Recommended because…"
    │   ├── csv/               # CSV import parsing + validation
    │   └── calendar/          # .ics / Google Calendar links
    └── types/database.ts      # table types
```

## Install on a phone

PWA install needs HTTPS, which the free `*.vercel.app` address provides.

- **Android (Chrome):** open the site → *Install app*.
- **iPhone (Safari):** open the site → Share → *Add to Home Screen*.
  Push notifications need iOS 16.4+ and the app installed to the home screen.
