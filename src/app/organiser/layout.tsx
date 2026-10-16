import { Suspense } from "react";
import { NavFallback } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { TopBar } from "@/components/nav/TopBar";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Organiser studio: the same shell and tab bar as the rest of the app (Studio is a tab). Pages check membership themselves. */
export default function OrganiserLayout({ children }: LayoutProps<"/organiser">) {
  return (
    <div className="lg:pl-64">
      <div className="mx-auto min-h-dvh max-w-3xl pb-28 [--page-top:1rem] md:px-2 lg:max-w-6xl lg:px-6 lg:pb-16 lg:[--page-top:2rem]">
        <TopBar />
        {children}
      </div>
      <Suspense fallback={<NavFallback />}>
        <MainNav />
      </Suspense>
    </div>
  );
}
