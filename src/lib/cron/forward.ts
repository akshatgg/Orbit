import "server-only";

import { NextResponse } from "next/server";

import { api, ApiError } from "@/lib/api/client";

/**
 * Vercel Cron still fires the schedules in vercel.json, but the work runs on
 * the Orbit API. These helpers pass a cron (or admin) call through and hand
 * back the backend's answer unchanged.
 */

const CRON_TIMEOUT_MS = 290_000;

export function cronAuthorised(authorization: string | null) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function forwardToBackend(
  path: string,
  { method, authorization, token }: { method: "GET" | "POST"; authorization?: string; token?: string },
) {
  try {
    const response = await api.raw(path, {
      method,
      token,
      headers: authorization ? { authorization } : undefined,
      signal: AbortSignal.timeout(CRON_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError) {
      const status = error.status || 502;
      return NextResponse.json(error.body ?? { error: error.message }, { status });
    }
    throw error;
  }
}
