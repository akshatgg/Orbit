import { NextResponse } from "next/server";
import { logInteraction } from "@/lib/actions/user-events";
import { getEvent } from "@/lib/tickets/queries";
import { safeHttpUrl } from "@/lib/tickets/logic";

/** Outbound click for external registration: log it, then send the visitor on. */
export async function GET(req: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const event = await getEvent(id);
  const target = event && event.registration_mode === "external" && event.status === "published"
    ? safeHttpUrl(event.external_url)
    : null;

  if (!event || !target) {
    return NextResponse.redirect(new URL(event ? `/events/${event.id}` : "/", req.url), 302);
  }
  await logInteraction(event.id, "apply_click");
  return NextResponse.redirect(target, 302);
}
