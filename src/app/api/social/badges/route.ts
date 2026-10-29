import { getBadgeCounts } from "@/lib/social/queries";
import { json } from "../_shared";

/** Unread notifications + unread messages, for the nav badges (polled about every 30 s). */
export async function GET() {
  return json(getBadgeCounts);
}
