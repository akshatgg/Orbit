import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getThread } from "@/lib/social/queries";
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
  return json(async () => {
    const thread = await getThread(id, query);
    // Removed from the circle, blocked, or the conversation is gone.
    if (!thread) throw new ApiError(403, "You no longer have access to this conversation");
    return thread;
  });
}
