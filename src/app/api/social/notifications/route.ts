import { NextResponse, type NextRequest } from "next/server";
import { getInbox, listMyInvites } from "@/lib/social/queries";
import { json, SAFE_TIME } from "../_shared";

const PAGE = 20;

/**
 * The bell's list, newest first, a page at a time (`?before=<created_at>`), with the unread count and
 * which invites still wait for an answer (so Accept / Decline only shows on those).
 */
export async function GET(request: NextRequest) {
  const before = request.nextUrl.searchParams.get("before") ?? undefined;
  if (before && !SAFE_TIME.test(before)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return json(async () => {
    const [inbox, invites] = await Promise.all([getInbox({ limit: PAGE, before }), listMyInvites().catch(() => [])]);
    return { ...inbox, has_more: inbox.items.length >= PAGE, pending_invite_ids: invites.map((i) => i.id) };
  });
}
