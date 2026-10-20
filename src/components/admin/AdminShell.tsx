"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  IconArrowLeft, IconBadge, IconCalendar, IconGrid, IconMenu, IconRss, IconTag, IconUpload, IconUsers, IconX,
} from "./icons";

export type AdminLink = { href: string; label: string; group?: string };

const NAV_ICONS: Record<string, ReactNode> = {
  "/admin": <IconGrid size={17} />,
  "/admin/organisers": <IconBadge size={17} />,
  "/admin/events": <IconCalendar size={17} />,
  "/admin/users": <IconUsers size={17} />,
  "/admin/categories": <IconTag size={17} />,
  "/admin/import": <IconUpload size={17} />,
  "/admin/sources": <IconRss size={17} />,
};

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/admin"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Image src="/brand/orbit-mark.png" alt="" width={28} height={28} />
      <span className="text-[13px] font-semibold tracking-[0.2em]">ORBIT</span>
      <span className="rounded-full bg-ink/[0.08] px-2 py-0.5 text-[11px] font-medium text-muted">Admin</span>
    </Link>
  );
}

function NavItem({ link, active, onNavigate }: { link: AdminLink; active: boolean; onNavigate?: () => void }) {
  return (
    <li>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          active ? "bg-ink/[0.08] text-fg" : "text-muted hover:bg-ink/[0.05] hover:text-fg"
        }`}
      >
        {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
        <span className={active ? "text-accent" : "text-subtle transition-colors group-hover:text-muted"}>
          {NAV_ICONS[link.href] ?? <IconGrid size={17} />}
        </span>
        <span className="truncate">{link.label}</span>
      </Link>
    </li>
  );
}

function SidebarBody({
  links, pathname, onNavigate, close,
}: {
  links: AdminLink[]; pathname: string; onNavigate?: () => void; close?: ReactNode;
}) {
  const ungrouped = links.filter((link) => !link.group);
  const groups = [...new Set(links.map((link) => link.group).filter((group): group is string => !!group))];

  return (
    <>
      <div className="flex items-center justify-between gap-2 pb-6">
        <Brand onClick={onNavigate} />
        {close}
      </div>

      <nav aria-label="Admin sections" className="flex-1 space-y-5 overflow-y-auto pr-0.5">
        {ungrouped.length > 0 && (
          <ul className="space-y-0.5">
            {ungrouped.map((link) => (
              <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[11px] font-medium text-subtle">{group}</p>
            <ul className="space-y-0.5">
              {links
                .filter((link) => link.group === group)
                .map((link) => (
                  <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-line pt-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <IconArrowLeft size={16} /> Back to app
        </Link>
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-subtle">Appearance</span>
          <ThemeToggle className="h-9 w-9" />
        </div>
      </div>
    </>
  );
}

/**
 * Admin shell: one sidebar holds the brand, navigation, theme switch and "Back to app" at every
 * size. It is fixed from `lg` up; below that a floating button opens the same sidebar as a drawer.
 * The drawer closes on navigation, Escape or a tap on the backdrop.
 */
export function AdminShell({ links, children }: { links: AdminLink[]; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const drawerOpen = drawer.open && drawer.path === pathname;
  const drawerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = (restoreFocus = true) => {
    setDrawer({ open: false, path: pathname });
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawer({ open: false, path: pathname });
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, pathname]);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-bg/80 px-3 py-4 backdrop-blur-xl lg:flex xl:w-72">
        <SidebarBody links={links} pathname={pathname} />
      </aside>

      <div className="min-h-dvh lg:pl-64 xl:pl-72">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setDrawer({ open: true, path: pathname })}
          aria-label="Open admin menu"
          aria-expanded={drawerOpen}
          aria-controls="admin-sidebar-drawer"
          aria-haspopup="dialog"
          className="glass-strong fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          <IconMenu size={18} />
        </button>

        <main className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:pt-6">{children}</main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close admin menu"
            onClick={() => closeDrawer()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <aside
            id="admin-sidebar-drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-line bg-bg p-3 shadow-[0_0_60px_rgb(0_0_0/0.55)] outline-none"
          >
            <SidebarBody
              links={links}
              pathname={pathname}
              onNavigate={() => closeDrawer(false)}
              close={
                <button
                  type="button"
                  onClick={() => closeDrawer()}
                  aria-label="Close admin menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.06] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <IconX size={18} />
                </button>
              }
            />
          </aside>
        </div>
      )}
    </div>
  );
}
