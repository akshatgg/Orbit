import type { NextRequest } from "next/server";
import { buildGuestCsv, csvFilename } from "@/lib/guests/csv";
import { getEventQuestions, getManagedEvent, listGuests } from "@/lib/guests/queries";

/** Guest list as a CSV download. Only people who can manage the event get it. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/organiser/events/[id]/guests/export">) {
  const { id } = await ctx.params;
  const event = await getManagedEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  const [guests, questions] = await Promise.all([listGuests(id), getEventQuestions(id)]);
  // Oldest first reads more naturally in a spreadsheet.
  const csv = buildGuestCsv([...guests].reverse(), questions);
  const filename = csvFilename(event.title);

  // The BOM makes Excel open the file as UTF-8 (names with accents stay intact).
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
