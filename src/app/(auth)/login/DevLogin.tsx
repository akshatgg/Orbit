"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// One-tap sign-in as a seeded demo account. Only rendered in local development
// (NEXT_PUBLIC_DEV_LOGIN=1 lives in .env.development.local and is never set in production).
const ACCOUNTS = [
  { email: "student@imperial.ac.uk", label: "Student" },
  { email: "newbie@orbit.test", label: "New user" },
  { email: "organiser@orbit.test", label: "Organiser" },
  { email: "pending@orbit.test", label: "Pending org" },
  { email: "admin@orbit.test", label: "Admin" },
  { email: "akshatg9536@gmail.com", label: "Super admin" },
];

export function DevLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(email: string) {
    setBusy(email);
    const { error } = await createClient().auth.signInWithPassword({ email, password: "password123" });
    setBusy(null);
    if (!error) router.replace(new URLSearchParams(window.location.search).get("next") ?? "/");
  }

  return (
    <div className="mt-6 w-full rounded-[22px] border border-dashed border-white/15 bg-white/[0.025] p-4 backdrop-blur-xl">
      <p className="mb-3 text-center font-display text-[10px] uppercase tracking-[0.3em] text-subtle">Dev sign-in</p>
      <div className="grid grid-cols-2 gap-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.email}
            onClick={() => signIn(a.email)}
            disabled={busy !== null}
            data-testid={`dev-login-${a.label.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-2 text-xs text-muted transition-colors hover:bg-white/[0.08] hover:text-fg disabled:opacity-50"
          >
            {busy === a.email ? "…" : a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
