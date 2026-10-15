"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
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
    <div className="glass-strong mt-9 w-full space-y-4 rounded-[24px] p-5">
      <button
        onClick={signInWithGoogle}
        className="bg-gradient flex h-12 w-full items-center justify-center gap-3 rounded-full text-[15px] font-semibold text-bg transition duration-200 ease-out hover:brightness-95 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <GoogleG />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      {status === "sent" ? (
        <p role="status" className="py-2 text-center text-sm text-muted">Check your inbox for a login link.</p>
      ) : (
        <form onSubmit={sendEmailLink} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@imperial.ac.uk"
            aria-label="Email address"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className={buttonClass({ variant: "secondary", size: "lg", full: true })}
          >
            {status === "sending" ? "Sending…" : "Email me a login link"}
          </button>
          {status === "error" && (
            <p role="alert" className="text-center text-sm text-orange">Couldn&apos;t send the link. Try again.</p>
          )}
        </form>
      )}
      <p className="pt-1 text-center text-xs leading-relaxed text-subtle">
        University emails get a verified student badge. By continuing you agree to our terms and privacy policy.
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.500z" />
      <path fill="#4285F4" d="M46.5 24.500c0-1.6-.1-3.1-.4-4.500H24v9h12.700c-.6 3-2.2 5.5-4.7 7.200l7.6 5.900c4.4-4.1 6.9-10.1 6.9-17.600z" />
      <path fill="#FBBC05" d="M10.5 28.700a14.5 14.5 0 0 1 0-9.400l-7.9-6.100a24 24 0 0 0 0 21.600l7.9-6.100z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.800l-7.6-5.900c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.800l-7.9 6.100C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
