import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { apiMessage, type ErrorCopy } from "@/lib/api/errors";

import type { ActionResult } from "./types";

export type { ActionResult };

/**
 * Every admin action starts here: re-checks the caller is an admin (redirects otherwise).
 * The Orbit API checks again and writes the admin audit log itself.
 */
export async function adminContext() {
  const profile = await requireAdmin();
  return { profile };
}

/** Admin pages and every public list that shows events/organisers. */
export function revalidateEverywhere() {
  revalidatePath("/", "layout");
}

/** Copy for a failed admin call: the API's own sentence when it wrote one, else the fallback. */
export function adminError(error: unknown, copy: ErrorCopy = {}, fallback = "Something went wrong") {
  return apiMessage(error, copy, { fallback, passThrough: true });
}
