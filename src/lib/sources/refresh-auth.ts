// Who may trigger a full refresh: the Vercel cron (secret) or a signed-in admin on this site.

import { timingSafeEqual } from "node:crypto";
import type { RunTrigger } from "./types";

export type RefreshAuth = { ok: true; trigger: RunTrigger } | { ok: false; status: 401 | 403 };

type Input =
  | { method: "GET"; authorization: string | null; cronSecret: string | undefined }
  | { method: "POST"; isAdmin: boolean; origin: string | null; host: string | null };

function secretMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const given = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function authoriseRefresh(input: Input): RefreshAuth {
  if (input.method === "GET") {
    return secretMatches(input.authorization, input.cronSecret) ? { ok: true, trigger: "cron" } : { ok: false, status: 401 };
  }
  if (!input.isAdmin) return { ok: false, status: 401 };
  // Route handlers don't get Server Actions' origin check, so do it here (CSRF).
  if (!input.origin || !input.host) return { ok: false, status: 403 };
  try {
    return new URL(input.origin).host === input.host ? { ok: true, trigger: "manual" } : { ok: false, status: 403 };
  } catch {
    return { ok: false, status: 403 };
  }
}
