import type { RegistrationStatus } from "@/types/database";
import { Badge } from "@/components/ui/Badge";

const LABELS: Record<RegistrationStatus, { label: string; tone: "success" | "warning" | "info" | "danger" | "neutral" }> = {
  going: { label: "Going", tone: "success" },
  pending: { label: "Awaiting approval", tone: "warning" },
  waitlisted: { label: "Waitlisted", tone: "info" },
  awaiting_payment: { label: "Payment pending", tone: "warning" },
  declined: { label: "Not accepted", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
