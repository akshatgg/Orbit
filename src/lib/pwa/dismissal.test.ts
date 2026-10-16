import { describe, expect, it } from "vitest";
import {
  DISMISSED_KEY, DISMISS_MS, isBannerDue, isDismissed, readSignals, recordDismissal, recordMoment, recordVisit,
  type StorageLike,
} from "./dismissal";

function mem(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const broken: StorageLike = {
  getItem() { throw new Error("denied"); },
  setItem() { throw new Error("denied"); },
};

describe("recordVisit", () => {
  it("counts once per session", () => {
    const local = mem(), session = mem();
    expect(recordVisit(local, session)).toBe(1);
    expect(recordVisit(local, session)).toBe(1);
    expect(recordVisit(local, mem())).toBe(2); // new session
  });
  it("tolerates unavailable storage", () => {
    expect(recordVisit(broken, broken)).toBe(1);
    expect(recordVisit(null, null)).toBe(1);
    expect(readSignals(broken)).toEqual({ visits: 0, moment: false, dismissedAt: null });
  });
});

describe("isBannerDue", () => {
  const now = 1_000_000_000_000;
  it("is not due on the first visit", () => {
    expect(isBannerDue({ visits: 1, moment: false, dismissedAt: null }, now)).toBe(false);
  });
  it("is due from the second visit", () => {
    expect(isBannerDue({ visits: 2, moment: false, dismissedAt: null }, now)).toBe(true);
  });
  it("is due after a meaningful moment even on visit one", () => {
    const local = mem();
    recordMoment(local);
    expect(isBannerDue(readSignals(local), now)).toBe(true);
  });
  it("stays hidden for 14 days after dismissal, then returns", () => {
    const local = mem();
    recordDismissal(local, now);
    expect(local.data.get(DISMISSED_KEY)).toBe(String(now));
    const s = { visits: 5, moment: true, dismissedAt: readSignals(local).dismissedAt };
    expect(isBannerDue(s, now + DISMISS_MS - 1)).toBe(false);
    expect(isBannerDue(s, now + DISMISS_MS)).toBe(true);
  });
  it("isDismissed handles null", () => {
    expect(isDismissed(null, now)).toBe(false);
  });
});
