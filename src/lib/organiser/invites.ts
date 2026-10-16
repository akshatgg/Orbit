// Team invite links: the pure parts (validity, copy, URLs). The database enforces the same rules
// in accept_organiser_invite(); this lets the pages explain *why* a link doesn't work.

export type InviteFacts = {
  org_status: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked: boolean;
};

export type InviteProblem = "revoked" | "expired" | "full" | "org_inactive";

/** Why an invite can't be used right now, or null when it can. Checked in the order shown to people. */
export function inviteProblem(invite: InviteFacts, now = new Date()): InviteProblem | null {
  if (invite.revoked) return "revoked";
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return "expired";
  if (invite.uses >= invite.max_uses) return "full";
  if (invite.org_status !== "approved") return "org_inactive";
  return null;
}

export const INVITE_PROBLEM_COPY: Record<InviteProblem, { title: string; body: string }> = {
  revoked: { title: "This link has been turned off", body: "Ask the organisation's owner for a new invite link." },
  expired: { title: "This link has expired", body: "Invite links last 14 days. Ask the owner for a new one." },
  full: { title: "This link has been used up", body: "It reached its limit. Ask the owner for a new invite link." },
  org_inactive: { title: "This organisation can't take new members yet", body: "Try again once it's approved." },
};

/** Codes are lowercase hex from the database; accept any short alphanumeric token and nothing else. */
export function isValidInviteCode(code: string) {
  return /^[a-zA-Z0-9]{8,64}$/.test(code);
}

export function inviteUrl(appUrl: string, code: string) {
  return `${appUrl.replace(/\/+$/, "")}/join/${code}`;
}

/** "3 of 25 used · expires 30 Oct" style summary for the owner's list. */
export function inviteSummary(invite: Pick<InviteFacts, "uses" | "max_uses" | "expires_at" | "revoked">, now = new Date()) {
  if (invite.revoked) return "Turned off";
  const expires = new Date(invite.expires_at);
  if (expires.getTime() <= now.getTime()) return "Expired";
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(expires);
  return `${invite.uses} of ${invite.max_uses} used · expires ${day}`;
}

/** Whether an invite should still be listed as active for the owner. */
export function isInviteActive(invite: InviteFacts, now = new Date()) {
  return inviteProblem(invite, now) === null;
}
