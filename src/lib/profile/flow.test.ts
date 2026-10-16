import { describe, expect, it } from "vitest";
import {
  hasExplorerGoal, hasHostGoal, initialGoals, isHostOnly, landingPath, normalizeGoals, profileSteps,
  safeNextPath, showsStudioTab, stepsFor,
} from "./flow";

describe("goals", () => {
  it("keeps known goals, de-duplicated, in canonical order", () => {
    expect(normalizeGoals(["host", "career", "career", "bogus"])).toEqual(["career", "host"]);
    expect(normalizeGoals(null)).toEqual([]);
  });

  it("tells explorers from hosts", () => {
    expect(hasExplorerGoal(["social"])).toBe(true);
    expect(hasExplorerGoal(["host"])).toBe(false);
    expect(hasHostGoal(["career", "host"])).toBe(true);
    expect(isHostOnly(["host"])).toBe(true);
    expect(isHostOnly(["host", "network"])).toBe(false);
    expect(isHostOnly([])).toBe(false);
  });
});

describe("stepsFor", () => {
  it("explorers get the interest questions and no organisation", () => {
    expect(stepsFor(["career"])).toEqual(["goals", "describe", "interests", "events", "availability"]);
    expect(stepsFor(["network", "social"])).toEqual(["goals", "describe", "interests", "events", "availability"]);
  });

  it("host + explorer adds the organisation steps after the explorer ones", () => {
    expect(stepsFor(["career", "host"])).toEqual(["goals", "describe", "interests", "events", "availability", "organisation"]);
  });

  it("host-only skips every interest question", () => {
    expect(stepsFor(["host"])).toEqual(["goals", "about", "organisation"]);
    expect(stepsFor(["host"])).not.toContain("interests");
  });

  it("accounts with no goals yet get the explorer flow", () => {
    expect(stepsFor([])).toEqual(stepsFor(["career"]));
    expect(stepsFor(undefined)).toEqual(stepsFor(["career"]));
  });

  it("profileSteps leaves out the organisation application", () => {
    expect(profileSteps(["host"])).toEqual(["goals", "about"]);
    expect(profileSteps(["career", "host"])).not.toContain("organisation");
  });
});

describe("safeNextPath", () => {
  it("keeps same-site relative paths with a query", () => {
    expect(safeNextPath("/tickets/abc")).toBe("/tickets/abc");
    expect(safeNextPath("/events/1?x=2")).toBe("/events/1?x=2");
  });

  it("rejects anything that could leave the site or loop", () => {
    for (const bad of [null, undefined, "", "tickets", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)",
      "/onboarding", "/onboarding?x=1", "/login", "/auth/callback", "/a\nb", `/${"a".repeat(600)}`]) {
      expect(safeNextPath(bad as string)).toBeNull();
    }
  });

  it("reads the first value of a repeated param", () => {
    expect(safeNextPath(["/tickets", "/x"])).toBe("/tickets");
  });

  it("allows paths that merely start with a blocked word", () => {
    expect(safeNextPath("/onboardingish")).toBe("/onboardingish");
  });
});

describe("landingPath", () => {
  it("hosts land in Studio, whatever else they ticked", () => {
    expect(landingPath(["host"])).toBe("/organiser");
    expect(landingPath(["career", "host"], "/tickets/1")).toBe("/organiser");
  });

  it("explorers go back to a safe next, else For You", () => {
    expect(landingPath(["career"], "/tickets/1")).toBe("/tickets/1");
    expect(landingPath(["career"], "//evil.com")).toBe("/");
    expect(landingPath(["social"])).toBe("/");
    expect(landingPath([], null)).toBe("/");
  });
});

describe("studio tab and host intent", () => {
  it("shows Studio for hosts and for members of any organisation", () => {
    expect(showsStudioTab(["host"], 0)).toBe(true);
    expect(showsStudioTab(["career"], 1)).toBe(true);
    expect(showsStudioTab(["career"], 0)).toBe(false);
    expect(showsStudioTab([], 0)).toBe(false);
  });

  it("intent=host pre-selects Host only for people without goals", () => {
    expect(initialGoals("host", [])).toEqual(["host"]);
    expect(initialGoals(["host"], undefined)).toEqual(["host"]);
    expect(initialGoals("other", [])).toEqual([]);
    expect(initialGoals("host", ["career"])).toEqual(["career"]);
  });
});
