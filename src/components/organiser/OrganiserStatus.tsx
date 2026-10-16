import { Badge } from "@/components/ui/Badge";

const STATUS = {
  approved: { label: "Approved", tone: "success" },
  pending: { label: "Waiting for approval", tone: "warning" },
  rejected: { label: "Not approved", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
} as const;

export function OrganiserStatusBadge({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Small square logo with the organiser's initials as a fallback. */
export function OrganiserLogo({ src, name, size = 48, className = "" }: {
  src?: string | null; name: string; size?: number; className?: string;
}) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const style = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={style} className={`shrink-0 rounded-2xl border border-white/10 object-cover ${className}`} />
  ) : (
    <span
      style={{ ...style, fontSize: size * 0.34 }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] font-semibold tracking-tight text-fg ${className}`}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgb(222_159_251/0.22),rgb(63_121_253/0.14)_60%,rgb(253_181_112/0.16))]" />
      <span className="relative">{initials || "?"}</span>
    </span>
  );
}
