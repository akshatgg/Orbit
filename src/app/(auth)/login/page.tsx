import type { Metadata } from "next";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { Suspense } from "react";
import { InstallButton } from "@/components/pwa/InstallButton";
import { DevLogin } from "./DevLogin";
import { HostDoor } from "./HostDoor";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to ORBIT to get career, networking and social events picked for you.",
  alternates: { canonical: "/login" },
};

const VALUES = [
  { title: "Picked for you", body: "A feed ranked by your goals, interests and the week you actually have." },
  { title: "Tickets in your pocket", body: "Register in a tap and keep your QR pass ready for the door." },
  { title: "Host with ease", body: "Publish events, manage guests and check people in from one studio." },
] as const;

export default function LoginPage() {
  return (
    <div className="lg:grid lg:grid-cols-2">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:items-center lg:justify-center lg:px-12">
        <div className="-mb-20 -mt-10">
          <OrbitEmblem size={220} />
        </div>
        <h1 className="font-display text-5xl font-semibold tracking-[0.42em] indent-[0.42em]">ORBIT</h1>
        <p className="mt-3 font-display text-xs font-medium text-muted">Explore opportunities</p>
        <ul className="mt-12 w-full max-w-sm space-y-5">
          {VALUES.map((v) => (
            <li key={v.title} className="flex items-start gap-4">
              <span aria-hidden className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-accent">✓</span>
              <span>
                <span className="block font-semibold tracking-tight">{v.title}</span>
                <span className="block text-sm text-muted">{v.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 pb-8 pt-6 md:max-w-md lg:max-w-lg lg:px-10">
      <div className="-mb-12 -mt-6 lg:hidden">
        <OrbitEmblem size={118} />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-[0.42em] indent-[0.42em] lg:hidden">ORBIT</h1>
      <p className="mt-2.5 font-display text-xs font-medium text-muted lg:hidden">Explore opportunities</p>
      <LoginForm />
      <Suspense fallback={<p className="mt-5 h-5" />}>
        <HostDoor />
      </Suspense>
      <InstallButton variant="link" label="Install the app" className="mt-3" />
      {process.env.NEXT_PUBLIC_DEV_LOGIN === "1" && <DevLogin />}
    </main>
    </div>
  );
}
