import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const pearl = "bg-gradient text-bg hover:brightness-95";
const variants: Record<Variant, string> = {
  primary: pearl,
  light: pearl,
  secondary:
    "glass text-fg hover:bg-white/[0.09] hover:border-white/15",
  ghost: "text-muted hover:bg-white/[0.06] hover:text-fg",
  danger:
    "border border-red-400/25 bg-red-500/10 text-red-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-xl hover:bg-red-500/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass({ variant = "primary", size = "md", full = false, className = "" }: {
  variant?: Variant; size?: Size; full?: boolean; className?: string;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`;
}

type Common = { variant?: Variant; size?: Size; full?: boolean };

export function Button({ variant, size, full, className, ...props }: Common & ComponentProps<"button">) {
  return <button className={buttonClass({ variant, size, full, className })} {...props} />;
}

export function ButtonLink({ variant, size, full, className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, full, className })} {...props} />;
}
