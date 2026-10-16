import { Suspense } from "react";
import { BottomNavView } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { InstallBanner } from "@/components/pwa/InstallBanner";

import type { Metadata } from "next";

// Signed-in screens: nothing here is for search engines (signed-out "/" is the public landing page).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Student-facing screens with the bottom tab bar. Pages guard themselves with requireProfile(). */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <InstallBanner />
      {children}
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <MainNav />
      </Suspense>
    </div>
  );
}
