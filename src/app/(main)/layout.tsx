import { Suspense } from "react";
import { NavFallback } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { TopBar } from "@/components/nav/TopBar";

import type { Metadata } from "next";

// Signed-in screens: nothing here is for search engines (signed-out "/" is the public landing page).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Tabbed screens (For You, Explore, Tickets, Profile, Studio) share this shell, so the bars stay
 * mounted between pages: on phones a top bar and a bottom tab bar, from tablets up one fixed bar
 * across the top (DesktopHeader, rendered by MainNav). Pages guard themselves.
 */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-md pb-28 [--page-top:1rem] md:max-w-6xl md:px-4 md:pb-16 md:pt-16 md:[--page-top:2rem] lg:px-6">
        <TopBar />
        <InstallBanner />
        {children}
      </div>
      <Suspense fallback={<NavFallback />}>
        <MainNav />
      </Suspense>
    </>
  );
}
