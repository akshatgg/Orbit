import Link from "next/link";
import Image from "next/image";

/** Organiser studio shell. Pages check membership themselves. */
export default function OrganiserLayout({ children }: LayoutProps<"/organiser">) {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl">
        <Link href="/organiser" className="flex items-center gap-2">
          <Image src="/brand/orbit-mark.png" alt="" width={28} height={28} />
          <span className="font-display text-sm font-semibold tracking-[0.3em]">STUDIO</span>
        </Link>
        <Link href="/profile" className="text-sm text-muted hover:text-fg">Exit</Link>
      </header>
      {children}
    </div>
  );
}
