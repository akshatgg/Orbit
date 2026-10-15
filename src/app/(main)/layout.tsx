import { BottomNav } from "@/components/nav/BottomNav";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <InstallPrompt />
      {children}
      <BottomNav />
    </div>
  );
}
