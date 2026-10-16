import Link from "next/link";
import Image from "next/image";

/** Organiser studio shell: a slim floating glass top bar. Pages check membership themselves. */
export default function OrganiserLayout({ children }: LayoutProps<"/organiser">) {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-20 md:px-2 lg:max-w-6xl lg:px-6">
      <div className="sticky top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <header className="glass-strong flex h-12 items-center justify-between rounded-full pl-3 pr-1.5">
          <Link href="/organiser" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <span className="relative flex h-7 w-7 items-center justify-center">
              <span aria-hidden className="absolute inset-0 rounded-full bg-accent/30 blur-md" />
              <Image src="/brand/orbit-mark.png" alt="" width={26} height={26} className="relative" />
            </span>
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.34em] text-fg/90">Studio</span>
          </Link>
          <Link href="/profile" className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-fg">
            Exit
          </Link>
        </header>
      </div>
      <div className="pt-2">{children}</div>
    </div>
  );
}
