import { buildIcs } from "@/lib/calendar";
import { toCalendarEvent } from "@/lib/tickets/calendar";
import { getEvent } from "@/lib/tickets/queries";
import { logInteraction } from "@/lib/actions/user-events";

export async function GET(_req: Request, ctx: RouteContext<"/events/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  const event = await getEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  await logInteraction(event.id, "calendar_add");
  const body = buildIcs([toCalendarEvent(event)]);
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="orbit-event.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
