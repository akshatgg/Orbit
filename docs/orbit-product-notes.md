# ORBIT — Product notes (brainstorm)

Everything decided so far, collected from the brainstorming sessions (15–16 Oct 2026).
This is a notes document, not a build plan. Nothing here is implemented yet beyond
the scaffold already pushed to `github.com/akshatgg/Orbit`.

---

## 1. What ORBIT is

- **Name / tagline:** ORBIT — *Explore Opportunities*.
- **What it is:** a personalised **networking and events platform** — career events,
  networking, social events, society activities, fitness, workshops, competitions —
  anything worth attending. It is **not** an education product.
- **Core value:** not just listing events, but helping people find and attend the
  events that matter most to them.
- **Launch audience:** Imperial College London Business School MSc students.
  Later: other departments, other universities, wider student groups.
- **Original brief:** "Product Requirements Brief" by Swayam M. (6 pages).

### Problem it solves
1. **Fragmentation** — events are spread across university portals, Students' Union /
   society pages, careers platforms (Symplicity, Handshake), ticketing sites
   (Eventbrite, Luma, Fatsoma), and emails/newsletters.
2. **Information overload** — hard to tell valuable events from irrelevant ones.
3. **Missed opportunities** — people find events too late or forget to register/attend.

---

## 2. Brand

- Logo: iridescent star-in-circle emblem (violet → electric blue → cream → orange)
  on near-black, white wide-spaced "ORBIT" wordmark, lavender-grey tagline.
- App look: dark theme from the logo — background `#05040c`, gradient accents,
  white headings, lavender-grey secondary text.
- App icons and splash already generated from the logo.

---

## 3. Platform & cost decisions

- **Type:** PWA (Progressive Web App) — one codebase, installs on **iOS and Android**
  home screens, opens full-screen like a native app.
  - Android: "Install app" prompt. iPhone: Share → Add to Home Screen.
  - Push notifications: Android + iOS 16.4+ (when installed).
- **Address:** `orbit.akshatgg.in` — a free subdomain of the existing GoDaddy domain
  `akshatgg.in` (CNAME to Vercel, like `buddy.akshatgg.in`). No new domain purchase.
- **App stores later (optional):** wrap the same app with Capacitor if store listings
  are wanted (Apple $99/yr, Google $25 once).
- **Stack:** Next.js 16 + TypeScript + Tailwind on Vercel · the Orbit API (FastAPI +
  Postgres: accounts, data, email, Web Push, Stripe, Cloudinary uploads, event importers).
- **Backend:** `orbit-back.akshatgg.in`; its secrets live with the API, never in this app.
- **Code:** `github.com/akshatgg/Orbit` (public, branch `master`), committed as
  Akshat only.

---

## 4. Business model

- **Free for students** — no student subscription.
- **Revenue = B2B, once engagement is proven.** Three streams:
  1. **University partnerships (primary)** — annual SaaS fee for a central,
     personalised event-discovery platform that improves awareness, engagement and
     attendance across departments, careers teams and societies.
  2. **Employer partnerships & sponsored opportunities** — companies pay to promote
     career events, workshops, networking sessions and graduate opportunities to
     students whose interests match. Sponsored listings clearly labelled.
  3. **Event organiser promotions** — external organisers pay to promote events to a
     specific university or student audience (networking, competitions, workshops).
- **Pricing:** not decided — validate willingness to pay with university teams and
  employers first.
- **Go-to-market:** launch with Imperial Business School MSc students → validate →
  build engaged user base → then approach universities and employers commercially.

---

## 5. Event data — compliance first

- **No scraping of platforms that prohibit it.** Each source is evaluated individually.
- Preferred sources, in order:
  1. Official APIs / approved integrations (where use is permitted).
  2. University partnerships — authorised feeds, exports, approved methods from Imperial
     departments, careers teams, societies.
  3. **Organiser submissions** — societies, departments, employers, organisers post
     events directly (now a core feature, see §6.2).
  4. Permitted public sources — only where terms and law allow collection and reuse.
- MVP: a few approved sources + manual entry + CSV upload.
- Check each source's terms, API limits, attribution and privacy rules before integrating.
- Every event keeps its **source URL and provenance**.
- Sources are pluggable — add/remove independently; never dependent on one platform.
- Designed in from day one, not bolted on after launch.

---

## 6. Features

### 6.1 For students (attendees)

| # | Feature | Notes |
|---|---|---|
| 1 | Sign-up & onboarding | University, department, course, year; career interests; personal interests; preferred event types; format (in-person / online / hybrid); location; optional weekly availability. Editable anytime. |
| 2 | **For You** feed | Ranked, not chronological. Each card: "Recommended because…" |
| 3 | **This Week** | Top picks · Career & academic · Social & community · Other interests |
| 4 | **Calendar** view | Saved / registered events by day |
| 5 | Search & filters | Name, organiser, company, topic, keyword. Filters: date, category, career interest, format, location, price. Sort: relevance, date, deadline. |
| 6 | Event page (Luma-style) | Cover image, date/time, venue + map, organiser, price, spots left, "X going", description, share (WhatsApp / link) |
| 7 | Get ticket (free) | One tap → QR ticket in **My Tickets**; waitlist when full; cancel |
| 8 | Buy ticket (paid) | Pay inside ORBIT, money goes to the organiser (see §6.2) |
| 9 | Fill application | Answer the organiser's questions in ORBIT, wait for approval |
| 10 | **Apply Now** redirect | Opens the organiser's / university's own form or website |
| 11 | Save, add to calendar | Google Calendar / Apple calendar file |
| 12 | Mark registered / attended / not interested | ORBIT never claims a booking it can't verify |
| 13 | Follow organisers | Followed societies/companies rank higher |
| 14 | Reminders | Push + email before saved events and registration deadlines (later phase) |

### 6.2 For organisers (societies, university teams, employers, external organisers)

- **Becoming an organiser:** anyone can apply → **admin approves once** → after that
  their events go live straight away.
- **Organiser profile:** name, logo, bio, website; ✓ verified badge given by admin.
- **Create event:** title, cover photo, description, category/tags, date/time;
  in-person (venue + address), online (link shown only to ticket holders), or hybrid.
- **Registration — the organiser decides per event:**
  1. **Free tickets** — RSVP, capacity limit, waitlist, QR ticket.
  2. **Paid tickets** — organiser connects their own payment account (Stripe) and
     gets paid directly.
  3. **Application form inside ORBIT** — organiser's custom questions; organiser
     approves/declines each applicant.
  4. **External redirect** — organiser pastes their own URL (e.g. a university form);
     the **Apply Now** button sends people straight there.
  - Also: ticket types (e.g. General / VIP), registration deadline, approval on/off.
- **Guest list:** see registrations, approve/decline, export CSV.
- **Check-in at the door:** scan guests' QR tickets with the phone camera.
- **Stats:** views, Apply Now clicks, registrations, attendance (this data supports the
  university / employer sales pitch).
- **Edit / cancel event** → registered guests are notified.

### 6.3 Admin dashboard

- **Super admin:** `akshatg9636@gmail.com` — automatically admin on first sign-in.
- **The super admin can add multiple admins** (by email) and remove them.
- Admins can see and approve everything:
  - Approve / reject organiser applications; give or remove verified badge; suspend.
  - See all events; edit, unpublish, cancel, remove spam; mark cancelled/expired.
  - Add events manually; **CSV import** with preview and error check.
  - Manage categories and tags.
  - See users, tickets/registrations, and overall numbers.
  - Review duplicates and inaccurate listings; source status, ingestion errors and
    last-refresh times (once automatic sources exist).

### 6.4 Automatic event refresh (from the brief)

- Refresh every 48–72 hours (more often where practical).
- Detect new events, update changed ones, archive cancelled/expired, flag unverified
  dates/status, remove duplicates across sources, re-rank when events or preferences
  change. Urgent deadlines can trigger an earlier update/notification.

### 6.5 Recommendations (from the brief)

- Start with **transparent rule-based scoring**: career fit, course/department,
  preferred categories, date/location/availability, deadline/status, and whether the
  user already saved/registered/dismissed.
- Advanced AI personalisation only after the product is validated.

---

## 7. Later / not now

- Sponsored listings and organiser promotions (the paid B2B features).
- Automatic integrations with every platform.
- AI recommendations, predictive attendance.
- Social networking / chat / messaging.
- University timetable integration.
- Native app-store apps (Capacitor).

---

## 8. Suggested build order (when coding starts)

1. Organisers + admin approval, Create Event (all 4 registration types), event page,
   feed & search, admin dashboard basics.
2. Tickets: free RSVP, QR, waitlist, application approvals, guest list, check-in.
3. Paid tickets (Stripe).
4. Personalisation: ranking, This Week, follows, calendar.
5. Stats + full admin moderation.
6. Reminders (push + email); automatic event sources and refresh.

---

## 9. Success metrics (from the brief)

- Sign-ups that complete onboarding · weekly active users · weekly return rate
- Events discovered and saved per user · clicks to registration pages
- Reminder engagement and attendance (where measurable)
- Listing accuracy · coverage of relevant events
- **Success = students use ORBIT instead of checking several separate platforms.**

---

## 10. Open questions (to decide later)

- Paid tickets: does ORBIT take a platform fee per ticket, or 0% at launch?
  Who handles refunds — organiser or ORBIT?
- Can an organiser have multiple team members managing it?
- What qualifies an organiser for the ✓ verified badge?
- Can other admins also add admins, or only the super admin?
- Who can see the guest list details (names, emails, answers)? — UK GDPR wording,
  privacy policy, consent for sponsored targeting.
- Are non-students allowed to sign up and attend?
