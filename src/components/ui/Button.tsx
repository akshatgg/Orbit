import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";

const variants: Record<Variant, string> = {
  primary: "bg-gradient text-bg hover:brightness-110",
  light: "bg-fg text-bg hover:bg-fg/90",
  secondary: "border border-line bg-surface text-fg hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface hover:text-fg",
  danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
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
