import type { Metadata } from "next";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { Suspense } from "react";
import { InstallButton } from "@/components/pwa/InstallButton";
import { DevLogin } from "./DevLogin";
import { HostDoor } from "./HostDoor";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 pb-8 pt-6">
      <div className="-mb-12 -mt-6">
        <OrbitEmblem size={118} />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-[0.42em] indent-[0.42em]">ORBIT</h1>
      <p className="mt-2.5 font-display text-[11px] font-medium uppercase tracking-[0.34em] text-subtle">Explore opportunities</p>
      <LoginForm />
      <Suspense fallback={<p className="mt-5 h-5" />}>
        <HostDoor />
      </Suspense>
      <InstallButton variant="link" label="Install the app" className="mt-3" />
      {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && <DevLogin />}
    </main>
  );
}
