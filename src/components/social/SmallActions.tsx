"use client";

import { useState, useTransition, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { Result } from "@/lib/social/actions";

/**
 * A button that runs a pre-bound server action, optionally after a confirm, and shows its error in
 * place. Successful actions refresh the page themselves (revalidatePath) or redirect.
 */
export function ActionButton({ action, children, confirm, variant = "ghost", size = "sm", className = "", label, done }: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  label?: string;
  /** Shown after success instead of the button (e.g. "Request sent"). */
  done?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  if (finished && done) return <>{done}</>;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={pending}
        aria-busy={pending}
        className={buttonClass({ variant, size, className })}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            setError(null);
            let result: Result | undefined;
            try {
              result = await action();
            } catch (e) {
              // An action that redirects rejects with the redirect: the router is already on its way.
              if (isRedirect(e)) return;
              result = { ok: false, error: "Couldn't reach ORBIT. Try again." };
            }
            if (!result) return;
            if (result.ok) setFinished(true);
            else setError(result.error);
          });
        }}
      >
        {children}
      </button>
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </span>
  );
}

function isRedirect(error: unknown) {
  return !!error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
