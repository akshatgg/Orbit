"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function callbackUrl() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!isSupabaseConfigured) {
    return (
      <p className="mt-10 text-center text-sm text-muted">
        Add your Supabase keys to <code className="text-fg">.env.local</code> to enable sign-in.
      </p>
    );
  }

  async function signInWithGoogle() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  async function sendEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="mt-10 w-full space-y-4">
      <button
        onClick={signInWithGoogle}
        className="w-full rounded-xl bg-fg py-3 text-sm font-semibold text-bg"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      {status === "sent" ? (
        <p className="text-center text-sm text-muted">Check your inbox for a login link.</p>
      ) : (
        <form onSubmit={sendEmailLink} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@imperial.ac.uk"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="bg-gradient w-full rounded-xl py-3 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a login link"}
          </button>
          {status === "error" && (
            <p className="text-center text-sm text-orange">Couldn&apos;t send the link. Try again.</p>
          )}
        </form>
      )}
      <p className="text-center text-xs text-muted">
        University emails get a verified student badge.
      </p>
    </div>
  );
}
