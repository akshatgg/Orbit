import "server-only";
import { authed } from "@/lib/api/session";
import type { OrganiserStatus } from "@/types/database";

export type ImportOptions = {
  /** Every organiser, any status, by name. */
  organisers: { id: string; slug: string; name: string; status: OrganiserStatus }[];
  /** Every category in display order. */
  categories: { id: string; slug: string; name: string }[];
};

/** Organisers and categories for the admin event form, the CSV importer and the source form. */
export async function importOptions() {
  return authed.get<ImportOptions>("/admin/import/options");
}
