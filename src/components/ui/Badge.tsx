import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-muted",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-orange/30 bg-orange/10 text-orange",
  danger: "border-red-500/30 bg-red-500/10 text-red-300",
  info: "border-blue/30 bg-blue/10 text-blue",
  brand: "border-violet/40 bg-violet/10 text-pink",
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
    <span title="Verified organiser" aria-label="Verified" className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue text-[10px] font-bold text-white ${className}`}>
      ✓
    </span>
  );
}
