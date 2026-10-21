import { describe, expect, it } from "vitest";
import {
  answersFromForm,
  defaultTicketId,
  formatTicketCode,
  friendlyError,
  inlineParts,
  linkify,
  mapsUrl,
  paragraphs,
  registerLabel,
  registerVariant,
  safeHttpUrl,
  selectCta,
  splitTickets,
  validateAnswers,
  type CtaEvent,
  type Question,
  type TicketOption,
} from "./logic";

const NOW = new Date("2026-10-16T12:00:00Z");

const event = (over: Partial<CtaEvent> = {}): CtaEvent => ({
  status: "published",
  registration_mode: "tickets",
  requires_approval: false,
  waitlist_enabled: true,
  starts_at: "2026-10-20T18:00:00Z",
  ends_at: "2026-10-20T20:00:00Z",
  registration_deadline: null,
  external_url: null,
  external_label: "Apply now",
  currency: "GBP",
  ...over,
});

const ticket = (over: Partial<TicketOption> = {}): TicketOption => ({
  id: "t1", name: "General", description: null, price: 0, currency: "GBP", remaining: null, sales_end_at: null, ...over,
});

const cta = (over: Partial<Parameters<typeof selectCta>[0]> = {}) =>
  selectCta({ event: event(), registrationStatus: null, tickets: [ticket()], questionCount: 0, now: NOW, ...over });

describe("selectCta", () => {
  it("offers a one-tap free ticket", () => {
    expect(cta()).toEqual({ kind: "register", variant: "free", label: "Get free ticket", needsSheet: false });
  });

  it("asks for approval before anything else but a full event", () => {
    expect(cta({ event: event({ requires_approval: true }), questionCount: 2 })).toMatchObject({
      variant: "approval", label: "Request to join", needsSheet: true,
    });
  });

  it("labels paid tickets with the price, or 'Get tickets' for mixed prices", () => {
    expect(cta({ tickets: [ticket({ price: 15 })] })).toMatchObject({ variant: "paid", label: "Buy ticket · £15" });
    expect(cta({ tickets: [ticket({ price: 5 }), ticket({ id: "t2", price: 15 })] })).toMatchObject({
      variant: "paid", label: "Get tickets", needsSheet: true,
    });
  });

  it("joins the waitlist when every ticket is gone, or says sold out without one", () => {
    const full = [ticket({ remaining: 0 })];
    expect(cta({ tickets: full })).toMatchObject({ variant: "waitlist", label: "Join waitlist" });
    expect(cta({ tickets: full, event: event({ waitlist_enabled: false }) })).toEqual({ kind: "sold_out" });
  });

  it("prefers a ticket type that still has room", () => {
    expect(cta({ tickets: [ticket({ remaining: 0 }), ticket({ id: "t2", remaining: 3 })] })).toMatchObject({
      variant: "free", needsSheet: true,
    });
  });

  it("shows the registration when there is one", () => {
    expect(cta({ registrationStatus: "pending" })).toEqual({ kind: "registered", status: "pending" });
    expect(cta({ registrationStatus: "declined" })).toEqual({ kind: "declined" });
    expect(cta({ registrationStatus: "cancelled" })).toMatchObject({ kind: "register" });
  });

  it("handles closed, cancelled, ended, draft, info-only and external events", () => {
    expect(cta({ event: event({ registration_deadline: "2026-10-15T00:00:00Z" }) })).toEqual({ kind: "closed" });
    expect(cta({ tickets: [ticket({ sales_end_at: "2026-10-01T00:00:00Z" })] })).toEqual({ kind: "closed" });
    expect(cta({ event: event({ status: "cancelled" }), registrationStatus: "going" })).toEqual({ kind: "cancelled" });
    expect(cta({ event: event({ ends_at: "2026-10-10T00:00:00Z", starts_at: "2026-10-09T00:00:00Z" }), registrationStatus: "going" }))
      .toEqual({ kind: "ended", registrationStatus: "going" });
    expect(cta({ event: event({ status: "draft" }) })).toEqual({ kind: "preview" });
    expect(cta({ event: event({ registration_mode: "none" }) })).toEqual({ kind: "info" });
    expect(cta({ event: event({ registration_mode: "external", external_url: "https://x.test", external_label: "Register" }) }))
      .toEqual({ kind: "external", label: "Register" });
  });
});

describe("register labels", () => {
  it("follows the database order: full, approval, paid, free", () => {
    expect(registerVariant({ full: true, requiresApproval: true, price: 10 })).toBe("waitlist");
    expect(registerVariant({ full: false, requiresApproval: true, price: 10 })).toBe("approval");
    expect(registerVariant({ full: false, requiresApproval: false, price: 10 })).toBe("paid");
    expect(registerLabel("paid", 7.5)).toBe("Buy ticket · £7.50");
  });

  it("pre-selects the first ticket with room", () => {
    expect(defaultTicketId([ticket({ remaining: 0 }), ticket({ id: "t2" })], NOW)).toBe("t2");
    expect(defaultTicketId([ticket({ remaining: 0 })], NOW)).toBe("t1");
    expect(defaultTicketId([ticket({ sales_end_at: "2026-01-01T00:00:00Z" })], NOW)).toBeNull();
  });
});

describe("validateAnswers", () => {
  const qs: Question[] = [
    { id: "a", label: "Programme", kind: "single_select", options: ["MSc", "MBA"], required: true },
    { id: "b", label: "Why", kind: "long_text", options: [], required: true },
    { id: "c", label: "LinkedIn", kind: "short_text", options: [], required: false },
    { id: "d", label: "Topics", kind: "multi_select", options: ["x", "y"], required: false },
    { id: "e", label: "I agree", kind: "checkbox", options: [], required: true },
  ];

  it("flags missing required answers", () => {
    const { errors, answers } = validateAnswers(qs, {});
    expect(Object.keys(errors).sort()).toEqual(["a", "b", "e"]);
    expect(answers).toEqual({});
  });

  it("cleans and keeps valid answers keyed by question id", () => {
    const { errors, answers } = validateAnswers(qs, {
      a: "MBA", b: "  Because markets  ", c: "", d: ["y", "x", "y"], e: "on", zzz: "ignored",
    });
    expect(errors).toEqual({});
    expect(answers).toEqual({ a: "MBA", b: "Because markets", d: ["y", "x"], e: true });
  });

  it("rejects options that aren't offered and overly long text", () => {
    const { errors } = validateAnswers(qs, { a: "PhD", b: "x".repeat(5000), d: ["z"], e: "on" });
    expect(Object.keys(errors).sort()).toEqual(["a", "b", "d"]);
  });

  it("reads answers out of form data", () => {
    const fd = new FormData();
    fd.append("q_a", "MSc");
    fd.append("q_d", "x");
    fd.append("q_d", "y");
    expect(answersFromForm(qs, fd)).toMatchObject({ a: "MSc", d: ["x", "y"], e: null });
  });
});

describe("text helpers", () => {
  it("links http(s) and www URLs without trailing punctuation", () => {
    expect(linkify("See https://imperial.ac.uk/events, or www.example.com.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://imperial.ac.uk/events", href: "https://imperial.ac.uk/events" },
      { type: "text", value: ", or " },
      { type: "link", value: "www.example.com", href: "https://www.example.com/" },
      { type: "text", value: "." },
    ]);
    expect(linkify("javascript:alert(1) stays text")).toEqual([{ type: "text", value: "javascript:alert(1) stays text" }]);
    expect(linkify("(https://en.wikipedia.org/wiki/A_(b))")[1]).toMatchObject({ href: "https://en.wikipedia.org/wiki/A_(b)" });
  });

  it("parses bold and italic without breaking links", () => {
    expect(inlineParts("**Bold** and *italic* https://x.test")).toEqual([
      { type: "bold", children: [{ type: "text", value: "Bold" }] },
      { type: "text", value: " and " },
      { type: "italic", children: [{ type: "text", value: "italic" }] },
      { type: "text", value: " " },
      { type: "link", value: "https://x.test", href: "https://x.test/" },
    ]);
    expect(inlineParts("**See https://x.test**")).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", value: "See " },
          { type: "link", value: "https://x.test", href: "https://x.test/" },
        ],
      },
    ]);
  });

  it("leaves arithmetic and unpaired markers as plain text", () => {
    expect(inlineParts("2 * 3 * 4")).toEqual([{ type: "text", value: "2 * 3 * 4" }]);
    expect(inlineParts("**unclosed")).toEqual([{ type: "text", value: "**unclosed" }]);
  });

  it("splits paragraphs on blank lines", () => {
    expect(paragraphs("One\nline two\r\n\r\n\nTwo  ")).toEqual(["One\nline two", "Two"]);
    expect(paragraphs(null)).toEqual([]);
  });

  it("only accepts http(s) URLs", () => {
    expect(safeHttpUrl("https://a.test/x")).toBe("https://a.test/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("nope")).toBeNull();
  });

  it("builds maps links and readable codes", () => {
    expect(mapsUrl(["Room 220", null, "London"])).toBe(
      "https://www.google.com/maps/search/?api=1&query=Room%20220%2C%20London",
    );
    expect(mapsUrl([null, ""])).toBeNull();
    expect(formatTicketCode("a1b2c3d4e5")).toBe("A1B2 C3D4 E5");
  });

  it("only shows friendly database errors", () => {
    expect(friendlyError("Please answer: Why?")).toBe("Please answer: Why?");
    expect(friendlyError('invalid input syntax for type uuid: "x"')).toBe("Something went wrong. Please try again.");
  });
});

describe("splitTickets", () => {
  it("drops cancelled/declined and orders upcoming soonest first, past latest first", () => {
    const row = (id: string, status: string, starts_at: string) => ({ id, status, event: { starts_at, ends_at: null } });
    const { upcoming, past } = splitTickets(
      [
        row("later", "going", "2026-10-30T10:00:00Z"),
        row("soon", "pending", "2026-10-17T10:00:00Z"),
        row("gone", "cancelled", "2026-10-18T10:00:00Z"),
        row("old", "going", "2026-09-01T10:00:00Z"),
        row("older", "going", "2026-08-01T10:00:00Z"),
        row("no", "declined", "2026-08-02T10:00:00Z"),
      ],
      NOW,
    );
    expect(upcoming.map((r) => r.id)).toEqual(["soon", "later"]);
    expect(past.map((r) => r.id)).toEqual(["old", "older"]);
  });
});
