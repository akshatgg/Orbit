import { describe, expect, it } from "vitest";
import {
  applicationFeePence,
  checkoutBlocker,
  checkoutExpiresAt,
  checkoutOutcome,
  connectState,
  isOrganiserPayable,
  isReusableSession,
  lineItemName,
  parseFeePercent,
  shouldFulfil,
  toPence,
} from "./logic";

describe("toPence", () => {
  it("converts pounds to pence", () => {
    expect(toPence(5)).toBe(500);
    expect(toPence(15)).toBe(1500);
    expect(toPence(12.5)).toBe(1250);
  });
  it("avoids floating point drift", () => {
    expect(toPence(19.99)).toBe(1999);
    expect(toPence(0.29)).toBe(29);
    expect(toPence(1.005)).toBe(100);
  });
  it("accepts numeric strings from Postgres", () => {
    expect(toPence("5.00")).toBe(500);
    expect(toPence("7.5")).toBe(750);
  });
  it("treats empty, negative and junk as zero", () => {
    expect(toPence(0)).toBe(0);
    expect(toPence(-3)).toBe(0);
    expect(toPence(null)).toBe(0);
    expect(toPence(undefined)).toBe(0);
    expect(toPence("abc")).toBe(0);
  });
});

describe("parseFeePercent", () => {
  it("defaults to zero", () => {
    expect(parseFeePercent(undefined)).toBe(0);
    expect(parseFeePercent("")).toBe(0);
    expect(parseFeePercent("  ")).toBe(0);
  });
  it("parses numbers and a trailing %", () => {
    expect(parseFeePercent("5")).toBe(5);
    expect(parseFeePercent("2.5")).toBe(2.5);
    expect(parseFeePercent("3%")).toBe(3);
  });
  it("rejects invalid values and caps at 100", () => {
    expect(parseFeePercent("nope")).toBe(0);
    expect(parseFeePercent("-4")).toBe(0);
    expect(parseFeePercent("250")).toBe(100);
  });
});

describe("applicationFeePence", () => {
  it("is zero when there's no fee", () => {
    expect(applicationFeePence(500, 0)).toBe(0);
    expect(applicationFeePence(0, 10)).toBe(0);
  });
  it("rounds to the nearest penny", () => {
    expect(applicationFeePence(500, 5)).toBe(25);
    expect(applicationFeePence(1500, 2.5)).toBe(38); // 37.5 → 38
    expect(applicationFeePence(999, 3)).toBe(30); // 29.97 → 30
  });
  it("never exceeds the ticket price", () => {
    expect(applicationFeePence(500, 100)).toBe(500);
  });
});

describe("lineItemName", () => {
  it("joins event and ticket", () => {
    expect(lineItemName("Founders Friday", "Student")).toBe("Founders Friday — Student");
  });
  it("falls back to the event title", () => {
    expect(lineItemName(" Founders Friday ", null)).toBe("Founders Friday");
    expect(lineItemName("Founders Friday", "  ")).toBe("Founders Friday");
  });
  it("trims very long names", () => {
    expect(lineItemName("x".repeat(300), "VIP")).toHaveLength(250);
  });
});

describe("checkout expiry", () => {
  const now = Date.UTC(2026, 9, 16, 12, 0, 0);
  it("lasts 31 minutes (Stripe's 30-minute minimum plus slack)", () => {
    expect(checkoutExpiresAt(now)).toBe(now / 1000 + 31 * 60);
  });
  it("reuses only open sessions with time left", () => {
    const later = now / 1000 + 20 * 60;
    expect(isReusableSession({ status: "open", expires_at: later, url: "https://x" }, now)).toBe(true);
    expect(isReusableSession({ status: "open", expires_at: now / 1000 + 60, url: "https://x" }, now)).toBe(false);
    expect(isReusableSession({ status: "expired", expires_at: later, url: "https://x" }, now)).toBe(false);
    expect(isReusableSession({ status: "open", expires_at: later, url: null }, now)).toBe(false);
  });
});

describe("checkoutBlocker", () => {
  const reg = { user_id: "u1", status: "awaiting_payment", amount: 5, currency: "GBP", payment_status: "pending" };
  it("allows an unpaid GBP ticket owned by the user", () => {
    expect(checkoutBlocker(reg, "u1")).toBeNull();
    expect(checkoutBlocker({ ...reg, amount: "15.00" }, "u1")).toBeNull();
  });
  it("blocks someone else's registration", () => {
    expect(checkoutBlocker(reg, "u2")).toMatch(/couldn't find/);
    expect(checkoutBlocker(null, "u1")).toMatch(/couldn't find/);
  });
  it("blocks paid, free and non-awaiting tickets", () => {
    expect(checkoutBlocker({ ...reg, payment_status: "paid", status: "going" }, "u1")).toMatch(/already paid/);
    expect(checkoutBlocker({ ...reg, status: "going" }, "u1")).toMatch(/already got a ticket/);
    expect(checkoutBlocker({ ...reg, status: "pending" }, "u1")).toMatch(/approve/);
    expect(checkoutBlocker({ ...reg, status: "waitlisted" }, "u1")).toMatch(/waitlist/);
    expect(checkoutBlocker({ ...reg, status: "cancelled" }, "u1")).toMatch(/isn't waiting/);
    expect(checkoutBlocker({ ...reg, amount: 0 }, "u1")).toMatch(/free/);
  });
  it("only supports GBP", () => {
    expect(checkoutBlocker({ ...reg, currency: "EUR" }, "u1")).toMatch(/GBP/);
  });
});

describe("connectState", () => {
  it("maps each stage", () => {
    expect(connectState({ configured: false, accountId: "acct_1", chargesEnabled: true })).toBe("unconfigured");
    expect(connectState({ configured: true, accountId: null, chargesEnabled: false })).toBe("not_connected");
    expect(connectState({ configured: true, accountId: "acct_1", chargesEnabled: false })).toBe("incomplete");
    expect(connectState({ configured: true, accountId: "acct_1", chargesEnabled: true })).toBe("connected");
  });
  it("knows when an organiser can take money", () => {
    expect(isOrganiserPayable({ stripe_account_id: "acct_1", stripe_charges_enabled: true })).toBe(true);
    expect(isOrganiserPayable({ stripe_account_id: "acct_1", stripe_charges_enabled: false })).toBe(false);
    expect(isOrganiserPayable({ stripe_account_id: null, stripe_charges_enabled: true })).toBe(false);
    expect(isOrganiserPayable(null)).toBe(false);
  });
});

describe("checkoutOutcome", () => {
  it("maps Stripe session states", () => {
    expect(checkoutOutcome({ status: "complete", payment_status: "paid" })).toBe("paid");
    expect(checkoutOutcome({ status: "complete", payment_status: "unpaid" })).toBe("processing");
    expect(checkoutOutcome({ status: "expired", payment_status: "unpaid" })).toBe("expired");
    expect(checkoutOutcome({ status: "open", payment_status: "unpaid" })).toBe("open");
    expect(checkoutOutcome({ status: null, payment_status: "unpaid" })).toBe("open");
  });
});

describe("shouldFulfil", () => {
  it("needs a paid session that names a registration", () => {
    expect(shouldFulfil({ payment_status: "paid", metadata: { registration_id: "r1" } })).toBe(true);
    expect(shouldFulfil({ payment_status: "unpaid", metadata: { registration_id: "r1" } })).toBe(false);
    expect(shouldFulfil({ payment_status: "paid", metadata: {} })).toBe(false);
    expect(shouldFulfil({ payment_status: "paid", metadata: null })).toBe(false);
  });
});
