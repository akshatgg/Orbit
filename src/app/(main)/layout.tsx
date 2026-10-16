import { Suspense } from "react";
import { NavFallback } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { InstallBanner } from "@/components/pwa/InstallBanner";

/** Student-facing screens with the bottom tab bar. Pages guard themselves with requireProfile(). */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="lg:pl-64">
      <div className="mx-auto min-h-dvh max-w-md pb-28 md:max-w-3xl md:px-2 lg:max-w-6xl lg:px-6 lg:pb-16">
        <InstallBanner />
        {children}
      </div>
      <Suspense fallback={<NavFallback />}>
        <MainNav />
      </Suspense>
    </div>
  );
}
