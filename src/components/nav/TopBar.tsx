import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ICONS, IconLink } from "@/components/discovery/Layout";
import { OrbitLogo } from "@/components/brand/OrbitLogo";
import { MessagesLink } from "@/components/social/MessagesLink";
import { NotificationBell } from "@/components/social/NotificationBell";

/**
 * Top bar on phones for every tabbed screen (For You, Explore, Tickets, Profile, Studio):
 * ORBIT mark + wordmark on the left, theme toggle, calendar, search, messages and notifications on the
 * right. From md up the DesktopHeader takes over, so this hides.
 */
export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] md:hidden">
      <Link href="/" aria-label="ORBIT home" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <OrbitLogo size={32} priority className="h-8 w-8" />
        <span className="text-[15px] font-semibold tracking-[0.2em] max-[374px]:sr-only">ORBIT</span>
      </Link>
      <div className="flex items-center gap-1.5">
        <ThemeToggle className="glass" />
        <IconLink href="/calendar" label="Your calendar" path={ICONS.calendar} />
        <IconLink href="/search" label="Search events" path={ICONS.search} />
        <MessagesLink className="glass h-10 w-10" />
        <NotificationBell placement="bar" className="glass h-10 w-10" />
      </div>
    </header>
  );
}
