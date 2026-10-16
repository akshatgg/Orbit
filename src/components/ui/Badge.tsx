import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, string> = {
  neutral: "border-ink/10 bg-ink/[0.06] text-muted",
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-orange/20 bg-orange/10 text-orange",
  danger: "border-red-400/20 bg-red-400/10 text-red-300",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  brand: "border-accent/25 bg-accent/10 text-accent",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** ✓ mark for verified organisers. */
export function VerifiedMark({ className = "" }: { className?: string }) {
  return (
    <span title="Verified organiser" aria-label="Verified" className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent ring-1 ring-accent/40 ${className}`}>
      ✓
    </span>
  );
}
