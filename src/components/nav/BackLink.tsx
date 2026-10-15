import Link from "next/link";

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
