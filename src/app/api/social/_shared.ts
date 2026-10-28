import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { apiMessage } from "@/lib/api/errors";

/**
 * Read-only JSON for the browser's polling (badges, the bell, an open thread). Server Actions are
 * dispatched one at a time, so polls go through these GET handlers instead; the session cookie is
 * forwarded by `authed`, and the Orbit API enforces every permission.
 */
export async function json<T>(load: () => Promise<T>) {
  try {
    return NextResponse.json(await load(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const status = error.status === 0 ? 502 : error.status;
    return NextResponse.json({ error: apiMessage(error, {}, { passThrough: true }) }, { status, headers: { "cache-control": "no-store" } });
  }
}

/** Ids and ISO timestamps only: nothing else is forwarded to the API. */
export const SAFE_ID = /^[\w-]{1,120}$/;
export const SAFE_TIME = /^[\d:.TZ+-]{10,40}$/;
