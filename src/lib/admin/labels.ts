// Display labels and badge tones for admin tables.
import type { EventStatus, OrganiserStatus } from "@/types/database";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export const ORGANISER_STATUS: Record<OrganiserStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  suspended: { label: "Suspended", tone: "neutral" },
};

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  removed: { label: "Removed", tone: "danger" },
};

export function sourceLabel(source: string, names?: Readonly<Record<string, string>>) {
  if (source === "orbit") return "Organiser";
  if (source === "manual") return "Admin";
  if (source === "csv") return "CSV";
  if (source.startsWith("source:")) {
    return names?.[source] ?? `Deleted source (${source.slice("source:".length, "source:".length + 8)})`;
  }
  return source;
}

/** Plain-English audit log lines. */
export const AUDIT_ACTIONS: Record<string, string> = {
  "organiser.approve": "approved organiser",
  "organiser.reject": "rejected organiser",
  "organiser.suspend": "suspended organiser",
  "organiser.reinstate": "reinstated organiser",
  "organiser.verify": "verified organiser",
  "organiser.unverify": "removed verified badge from",
  "event.feature": "featured",
  "event.unfeature": "unfeatured",
  "event.cancel": "cancelled",
  "event.remove": "removed",
  "event.delete": "permanently deleted",
  "event.restore": "restored",
  "event.reviewed": "marked as reviewed",
  "event.create": "added event",
  "event.update": "edited event",
  "event.category": "changed the category of",
  "user.verify_student": "verified student",
  "user.unverify_student": "removed student badge from",
  "user.add_admin": "made admin",
  "user.remove_admin": "removed admin",
  "category.create": "created category",
  "category.update": "updated category",
  "category.delete": "deleted category",
  "import.csv": "imported a CSV",
};

/** Escapes characters that would break a PostgREST `or=(...)` filter or act as wildcards. */
export function sanitiseSearch(q: string | undefined | null) {
  return (q ?? "").replace(/[%_\\,()*"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
