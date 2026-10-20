"use client";

import type { ReactNode } from "react";
import { useCollapsibleSidebar } from "./sidebar";

/**
 * Content column of the app shell. Its left padding follows the sidebar: a full 4rem gutter while
 * the sidebar is pinned open, a narrow one while it's an icon rail (hovering the rail floats the
 * sidebar over the content instead of pushing it).
 */
export function MainShell({ children }: { children: ReactNode }) {
  const { collapsed } = useCollapsibleSidebar("orbit-nav");
  return (
    <div
      className={`transition-[padding-left] duration-300 ease-out motion-reduce:transition-none ${
        collapsed ? "lg:pl-28" : "lg:pl-64"
      }`}
    >
      {children}
    </div>
  );
}
