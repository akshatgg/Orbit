import { NextResponse, type NextRequest } from "next/server";
import { getInbox, listMyInvites } from "@/lib/social/queries";
import { json, SAFE_CURSOR } from "../_shared";

/**
 * The bell's list, newest first, a page at a time (`?cursor=` from `next_cursor`), with the unread
 * count and which invites still wait for an answer (so Accept / Decline only shows on those).
 */
export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  if (cursor && !SAFE_CURSOR.test(cursor)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return json(async () => {
    const [inbox, invites] = await Promise.all([
      getInbox({ limit: 20, cursor }),
      cursor ? Promise.resolve([]) : listMyInvites().catch(() => []),
    ]);
    return { ...inbox, pending_invite_ids: invites.map((i) => i.id) };
  });
}
