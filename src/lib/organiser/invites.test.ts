import { describe, expect, it } from "vitest";
import { inviteProblem, inviteSummary, inviteUrl, isInviteActive, isValidInviteCode, type InviteFacts } from "./invites";

const NOW = new Date("2026-10-16T12:00:00Z");
const ok: InviteFacts = { org_status: "approved", expires_at: "2026-10-30T12:00:00Z", max_uses: 25, uses: 3, revoked: false };

describe("inviteProblem", () => {
  it("accepts a live invite for an approved organisation", () => {
    expect(inviteProblem(ok, NOW)).toBeNull();
    expect(isInviteActive(ok, NOW)).toBe(true);
  });

  it("rejects revoked, expired, used-up and unapproved", () => {
    expect(inviteProblem({ ...ok, revoked: true }, NOW)).toBe("revoked");
    expect(inviteProblem({ ...ok, expires_at: "2026-10-16T12:00:00Z" }, NOW)).toBe("expired");
    expect(inviteProblem({ ...ok, expires_at: "2026-10-01T00:00:00Z" }, NOW)).toBe("expired");
    expect(inviteProblem({ ...ok, uses: 25 }, NOW)).toBe("full");
    expect(inviteProblem({ ...ok, org_status: "pending" }, NOW)).toBe("org_inactive");
    expect(inviteProblem({ ...ok, org_status: "suspended" }, NOW)).toBe("org_inactive");
  });

  it("reports the most relevant problem first", () => {
    expect(inviteProblem({ ...ok, revoked: true, uses: 99, org_status: "pending" }, NOW)).toBe("revoked");
    expect(inviteProblem({ ...ok, expires_at: "2026-10-01T00:00:00Z", uses: 99 }, NOW)).toBe("expired");
  });

  it("allows the last remaining use", () => {
    expect(inviteProblem({ ...ok, uses: 24 }, NOW)).toBeNull();
  });
});

describe("invite helpers", () => {
  it("validates codes", () => {
    expect(isValidInviteCode("a1b2c3d4e5f6a7b8c9d0")).toBe(true);
    expect(isValidInviteCode("short")).toBe(false);
    expect(isValidInviteCode("../../etc/passwd")).toBe(false);
    expect(isValidInviteCode("abc def ghi jkl")).toBe(false);
  });

  it("builds join URLs without double slashes", () => {
    expect(inviteUrl("https://orbit.akshatgg.in/", "abc12345")).toBe("https://orbit.akshatgg.in/join/abc12345");
  });

  it("summarises usage and state", () => {
    expect(inviteSummary(ok, NOW)).toBe("3 of 25 used · expires 30 Oct");
    expect(inviteSummary({ ...ok, revoked: true }, NOW)).toBe("Turned off");
    expect(inviteSummary({ ...ok, expires_at: "2026-10-01T00:00:00Z" }, NOW)).toBe("Expired");
  });
});
