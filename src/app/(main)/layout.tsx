import { Suspense } from "react";
import { BottomNavView } from "@/components/nav/BottomNav";
import { MainNav } from "@/components/nav/MainNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Student-facing screens with the bottom tab bar. Pages guard themselves with requireProfile(). */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <InstallPrompt />
      {children}
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <MainNav />
      </Suspense>
    </div>
  );
}
