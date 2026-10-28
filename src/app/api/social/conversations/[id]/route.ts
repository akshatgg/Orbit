import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getThread } from "@/lib/social/queries";
import { json, SAFE_ID, SAFE_TIME } from "../../_shared";

/** An open thread's messages: `?after=<iso>` for new ones, nothing for the latest page. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/social/conversations/[id]">) {
  const { id } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const after = params.get("after") ?? undefined;
  const before = params.get("before") ?? undefined;
  if (!SAFE_ID.test(id) || (after && !SAFE_TIME.test(after)) || (before && !SAFE_TIME.test(before))) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return json(async () => {
    const thread = await getThread(id, { after, before });
    // Removed from the circle, blocked, or the conversation is gone.
    if (!thread) throw new ApiError(403, "You no longer have access to this conversation");
    return thread;
  });
}
