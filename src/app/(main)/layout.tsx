import { Suspense } from "react";
import { NavFallback } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { MainShell } from "@/components/nav/MainShell";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { TopBar } from "@/components/nav/TopBar";

import type { Metadata } from "next";

// Signed-in screens: nothing here is for search engines (signed-out "/" is the public landing page).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Tabbed screens (For You, Explore, Tickets, Profile, Studio) share this shell, so the top and tab bars stay mounted between tabs. Pages guard themselves. */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <MainShell>
      <div className="mx-auto min-h-dvh max-w-md pb-28 [--page-top:1rem] md:max-w-3xl md:px-2 lg:max-w-6xl lg:px-6 lg:pb-16 lg:[--page-top:2rem]">
        <TopBar />
        <InstallBanner />
        {children}
      </div>
      <Suspense fallback={<NavFallback />}>
        <MainNav />
      </Suspense>
    </MainShell>
  );
}
