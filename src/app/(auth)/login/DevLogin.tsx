"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

// Email + password sign-in against the Orbit API. Only rendered in local development
// (NEXT_PUBLIC_DEV_LOGIN=1 lives in .env.development.local and is never set in production).
// The API sets the session cookie; on localhost it is shared with the app.
const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8090";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

export function DevLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace(nextPath());
        router.refresh();
        return;
      }
      setError(res.status === 401 ? "Wrong email or password" : "Couldn't sign in. Try again.");
    } catch {
      setError("Couldn't reach the Orbit API.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={signIn} className="mt-6 w-full space-y-2 rounded-[22px] border border-dashed border-ink/15 bg-ink/[0.025] p-4">
      <p className="mb-1 text-center font-display text-xs text-muted">Dev sign-in</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Dev email"
        data-testid="dev-login-email"
        className={inputClass}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        aria-label="Dev password"
        data-testid="dev-login-password"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={busy}
        data-testid="dev-login-submit"
        className={buttonClass({ variant: "secondary", full: true })}
      >
        {busy ? "Signing in…" : "Sign in with password"}
      </button>
      {error && <p role="alert" className="text-center text-xs text-orange">{error}</p>}
    </form>
  );
}
