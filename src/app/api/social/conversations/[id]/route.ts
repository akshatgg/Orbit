import { NextResponse, type NextRequest } from "next/server";
import { authed } from "@/lib/api/session";
import type { Thread } from "@/types/social";
import { json, SAFE_ID, SAFE_TIME } from "../../_shared";

/**
 * An open thread's messages: `?after=<iso>&after_id=` for new ones (slim), `?before=&before_id=` for
 * an older page, nothing for the latest page (which also reflects deletions).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/social/conversations/[id]">) {
  const { id } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const query = {
    after: params.get("after") ?? undefined,
    after_id: params.get("after_id") ?? undefined,
    before: params.get("before") ?? undefined,
    before_id: params.get("before_id") ?? undefined,
  };
  const valid = SAFE_ID.test(id)
    && [query.after, query.before].every((t) => !t || SAFE_TIME.test(t))
    && [query.after_id, query.before_id].every((t) => !t || SAFE_ID.test(t));
  if (!valid) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  // Removed from the circle, blocked, or gone: the API's own sentence goes back to the thread.
  return json(() => authed.get<Thread>(`/messages/conversations/${encodeURIComponent(id)}`, { query: { limit: 50, ...query } }));
}
