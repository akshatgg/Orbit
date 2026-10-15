import Link from "next/link";

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="glass inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 text-sm text-muted transition-colors duration-200 hover:text-fg">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label}
    </Link>
  );
}
