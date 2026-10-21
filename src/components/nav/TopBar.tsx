import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ICONS, IconLink } from "@/components/discovery/Layout";

/**
 * Top bar on phones for every tabbed screen (For You, Explore, Tickets, Profile, Studio):
 * ORBIT mark + wordmark on the left, theme toggle and search on the right. From md up the
 * DesktopHeader takes over, so this hides.
 */
export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] md:hidden">
      <Link href="/" aria-label="ORBIT home" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <Image src="/brand/orbit-mark.png" alt="" width={32} height={32} priority className="h-8 w-8" />
        <span className="text-[15px] font-semibold tracking-[0.2em]">ORBIT</span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle className="glass" />
        <IconLink href="/search" label="Search events" path={ICONS.search} />
      </div>
    </header>
  );
}
