import { Suspense } from "react";
import { BottomNav, BottomNavView } from "@/components/nav/BottomNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Student-facing screens with the bottom tab bar. Pages guard themselves with requireProfile(). */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <InstallPrompt />
      {children}
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
