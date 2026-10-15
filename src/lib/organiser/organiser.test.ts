import { describe, expect, it } from "vitest";
import { groupOrganiserEvents, pickOrganiser, totalRegistrations } from "./dashboard";
import { emptyEventForm, eventToForm, formToEventRow, formToPrivateRow, formToQuestionRows, formToTicketRows, logisticsChanged, newQuestion, newTicket, type EventForm } from "./event-form";
import { fromDbRegistration, ticketPriceRange, toDbRegistration, type RegistrationChoice } from "./registration";
import { normaliseUrl, organiserApplicationSchema, teamMemberSchema, validateEventForm } from "./schemas";
import { isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Imperial Consulting Society")).toBe("imperial-consulting-society");
    expect(slugify("  Women in Finance & Tech!  ")).toBe("women-in-finance-and-tech");
    expect(slugify("Café Société")).toBe("cafe-societe");
    expect(slugify("King's College -- Careers")).toBe("kings-college-careers");
    expect(slugify("!!!")).toBe("");
  });

  it("caps the length without a trailing hyphen", () => {
    const s = slugify("a ".repeat(40) + "b");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("validates like the database", () => {
    expect(isValidSlug("london-founders-club")).toBe(true);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("Bad-Slug")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("-edge")).toBe(false);
  });
});

describe("registration mapping", () => {
  const cases: [RegistrationChoice, string, boolean][] = [
    ["tickets", "tickets", false],
    ["application", "tickets", true],
    ["external", "external", false],
    ["none", "none", false],
  ];
  it.each(cases)("%s ⇄ %s (approval %s)", (choice, mode, approval) => {
    expect(toDbRegistration(choice)).toEqual({ registration_mode: mode, requires_approval: approval });
    expect(fromDbRegistration(mode, approval)).toBe(choice);
  });

  it("ignores approval for non-ticket modes", () => {
    expect(fromDbRegistration("external", true)).toBe("external");
  });

  it("computes the card price range", () => {
    expect(ticketPriceRange([])).toEqual({ price_min: null, price_max: null });
    expect(ticketPriceRange([0])).toEqual({ price_min: 0, price_max: 0 });
    expect(ticketPriceRange([15, 5, 0])).toEqual({ price_min: 0, price_max: 15 });
  });
});

describe("organiser schemas", () => {
  const base = {
    name: "Imperial Pottery", slug: "imperial-pottery", kind: "society", university: "",
    bio: "We make pots.", website: "pots.example.com", contact_email: "pots@example.com", logo_url: "",
  };

  it("accepts a good application and normalises the website", () => {
    const r = organiserApplicationSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data?.website).toBe("https://pots.example.com");
  });

  it("rejects bad slugs, kinds and emails", () => {
    expect(organiserApplicationSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(organiserApplicationSchema.safeParse({ ...base, kind: "cult" }).success).toBe(false);
    expect(organiserApplicationSchema.safeParse({ ...base, contact_email: "nope" }).success).toBe(false);
    expect(organiserApplicationSchema.safeParse({ ...base, website: "ftp://x.com" }).success).toBe(false);
  });

  it("validates team invites", () => {
    expect(teamMemberSchema.parse({ email: " a@b.co " })).toEqual({ email: "a@b.co", role: "editor" });
    expect(teamMemberSchema.safeParse({ email: "x", role: "editor" }).success).toBe(false);
  });

  it("normalises URLs", () => {
    expect(normaliseUrl("example.com/a")).toBe("https://example.com/a");
    expect(normaliseUrl("http://x.com")).toBe("http://x.com");
    expect(normaliseUrl("  ")).toBe("");
  });
});

function form(overrides: Partial<EventForm> = {}): EventForm {
  return {
    ...emptyEventForm(),
    title: "Case Night",
    starts_at: "2026-11-20T18:00",
    ends_at: "2026-11-20T20:00",
    venue_name: "Room 220",
    ...overrides,
  };
}

const now = new Date("2026-10-16T12:00:00Z");
const publish = { intent: "publish" as const, chargesEnabled: false, now };
const draft = { intent: "draft" as const, chargesEnabled: false, now };

describe("validateEventForm", () => {
  it("publishes a complete free-ticket event", () => {
    expect(validateEventForm(form(), publish).ok).toBe(true);
  });

  it("lets drafts skip publish-only rules", () => {
    const f = form({ venue_name: "", tickets: [] });
    expect(validateEventForm(f, draft).ok).toBe(true);
    const r = validateEventForm(f, publish);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["venue_name", "tickets"]));
      expect(r.issues.find((i) => i.path === "venue_name")?.step).toBe("when");
      expect(r.issues.find((i) => i.path === "tickets")?.step).toBe("tickets");
    }
  });

  it("always needs a title and start time", () => {
    const r = validateEventForm(form({ title: "x", starts_at: "" }), draft);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.step)).toEqual(["basics", "when"]);
  });

  it("checks the end and deadline order", () => {
    const r = validateEventForm(form({ ends_at: "2026-11-20T17:00", registration_deadline: "2026-11-21T10:00" }), draft);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(["ends_at", "registration_deadline"]);
  });

  it("blocks past start times only when they changed", () => {
    const past = form({ starts_at: "2026-10-01T18:00", ends_at: "" });
    expect(validateEventForm(past, publish).ok).toBe(false);
    expect(validateEventForm(past, { ...publish, originalStartsAt: "2026-10-01T17:00:00Z" }).ok).toBe(true);
    expect(validateEventForm(past, draft).ok).toBe(true);
  });

  it("blocks paid tickets until payouts are connected (drafts are fine)", () => {
    const paid = form({ tickets: [{ ...newTicket("Standard"), price: "15" }] });
    const r = validateEventForm(paid, publish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatchObject({ path: "tickets.0.price", step: "tickets" });
    expect(validateEventForm(paid, draft).ok).toBe(true);
    expect(validateEventForm(paid, { ...publish, chargesEnabled: true }).ok).toBe(true);
  });

  it("needs a link for external events, even as a draft", () => {
    const ext = form({ registration: "external", external_url: "" });
    expect(validateEventForm(ext, draft).ok).toBe(false);
    expect(validateEventForm({ ...ext, external_url: "uni.example.ac.uk/form" }, publish).ok).toBe(true);
  });

  it("needs questions (with options) for applications", () => {
    const app = form({ registration: "application", questions: [] });
    expect(validateEventForm(app, publish).ok).toBe(false);
    const q = { ...newQuestion(), label: "Programme?", kind: "single_select" as const, options: ["MSc"] };
    const r = validateEventForm({ ...app, questions: [q] }, publish);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe("questions.0.options");
    expect(validateEventForm({ ...app, questions: [{ ...q, options: ["MSc", "MBA"] }] }, publish).ok).toBe(true);
  });

  it("rejects bad numbers", () => {
    const r = validateEventForm(form({ capacity: "0", tickets: [{ ...newTicket(), price: "abc" }] }), draft);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(["capacity", "tickets.0.price"]);
  });
});

describe("event form ⇄ rows", () => {
  it("maps a ticketed application event", () => {
    const f = form({
      registration: "application", capacity: "30", tags: ["Consulting", "consulting", " finance "],
      tickets: [{ ...newTicket("Place"), price: "0", quantity: "20" }],
      questions: [{ ...newQuestion(), label: "Why?", kind: "long_text", options: ["ignored"] }],
    });
    const row = formToEventRow(f);
    expect(row).toMatchObject({
      registration_mode: "tickets", requires_approval: true, capacity: 30, waitlist_enabled: true,
      starts_at: "2026-11-20T18:00:00.000Z", tags: ["consulting", "finance"], price_min: 0, price_max: 0,
      external_url: null, timezone: "Europe/London",
    });
    expect(formToTicketRows(f)).toEqual([
      { id: undefined, name: "Place", price: 0, quantity: 20, sales_end_at: null, sort_order: 0 },
    ]);
    expect(formToQuestionRows(f)[0]).toMatchObject({ label: "Why?", kind: "long_text", options: [] });
  });

  it("drops tickets, capacity and venue where they don't apply", () => {
    const f = form({
      registration: "external", external_url: "https://x.example.com", display_price: "10",
      format: "online", online_url: "https://meet.example.com/x", capacity: "50",
    });
    const row = formToEventRow(f);
    expect(row).toMatchObject({
      registration_mode: "external", capacity: null, venue_name: null, price_min: 10, price_max: 10,
    });
    expect(formToTicketRows(f)).toEqual([]);
    expect(formToQuestionRows(f)).toEqual([]);
    expect(formToPrivateRow(f).online_url).toBe("https://meet.example.com/x");
    expect(formToPrivateRow({ ...f, format: "in_person" }).online_url).toBeNull();
  });

  it("reads a database event back into the form", () => {
    const f = eventToForm(
      {
        title: "Panel", summary: null, description: null, category_id: null, tags: ["esg"], cover_url: null,
        starts_at: "2026-10-20T17:00:00+00:00", ends_at: null, format: "hybrid", venue_name: "LT1", address: null,
        city: "London", registration_mode: "tickets", requires_approval: false, external_url: null,
        external_label: "Apply now", capacity: 150, waitlist_enabled: true, registration_deadline: null, price_min: 0,
      },
      { online_url: "https://meet.example.com", guest_info: null },
      [{ id: "30000000-0000-4000-8000-000000000008", name: "In person", price: "5.50", quantity: 100, sales_end_at: null }],
      [],
    );
    expect(f).toMatchObject({
      starts_at: "2026-10-20T18:00", registration: "tickets", capacity: "150", online_url: "https://meet.example.com",
      display_price: "",
    });
    expect(f.tickets[0]).toMatchObject({ id: "30000000-0000-4000-8000-000000000008", price: "5.5", quantity: "100" });
  });

  it("spots logistics changes", () => {
    const a = formToEventRow(form());
    expect(logisticsChanged(a, { ...a })).toBe(false);
    expect(logisticsChanged(a, { ...a, starts_at: "2026-11-20T18:00:00+00:00" })).toBe(false);
    expect(logisticsChanged(a, { ...a, venue_name: "Room 221" })).toBe(true);
    expect(logisticsChanged(a, { ...a, format: "online" })).toBe(true);
  });
});

describe("dashboard helpers", () => {
  const orgs = [
    { id: "p", status: "pending" },
    { id: "a", status: "approved" },
    { id: "b", status: "approved" },
  ];

  it("picks the requested approved organiser, else the first approved", () => {
    expect(pickOrganiser(orgs, "b")?.id).toBe("b");
    expect(pickOrganiser(orgs, ["b", "a"])?.id).toBe("b");
    expect(pickOrganiser(orgs, "p")?.id).toBe("a");
    expect(pickOrganiser(orgs, undefined)?.id).toBe("a");
    expect(pickOrganiser(orgs, "p", false)?.id).toBe("p");
    expect(pickOrganiser([{ id: "p", status: "pending" }], undefined)).toBeNull();
  });

  it("groups events", () => {
    const at = (d: string) => `2026-10-${d}T18:00:00Z`;
    const events = [
      { id: 1, status: "draft", starts_at: at("30"), ends_at: null },
      { id: 2, status: "published", starts_at: at("20"), ends_at: null },
      { id: 3, status: "published", starts_at: at("18"), ends_at: null },
      { id: 4, status: "published", starts_at: at("10"), ends_at: at("11") },
      { id: 5, status: "published", starts_at: at("16"), ends_at: "2026-10-16T20:00:00Z" },
      { id: 6, status: "cancelled", starts_at: at("22"), ends_at: null },
      { id: 7, status: "expired", starts_at: at("01"), ends_at: null },
      { id: 8, status: "removed", starts_at: at("05"), ends_at: null },
    ];
    const g = groupOrganiserEvents(events, now);
    expect(g.drafts.map((e) => e.id)).toEqual([1]);
    expect(g.upcoming.map((e) => e.id)).toEqual([5, 3, 2]);
    expect(g.past.map((e) => e.id)).toEqual([4, 7]);
    expect(g.cancelled.map((e) => e.id)).toEqual([6, 8]);
  });

  it("totals registrations", () => {
    expect(totalRegistrations([{ going: 3, pending: 1, waitlisted: 2 }, { going: 4, pending: 0, waitlisted: 0 }])).toBe(10);
    expect(totalRegistrations([])).toBe(0);
  });
});
