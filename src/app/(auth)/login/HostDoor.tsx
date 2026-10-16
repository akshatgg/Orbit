"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const HOST_NEXT = "/onboarding?intent=host";

/**
 * Separate door for organisers, under the sign-in card. It only changes where sign-in lands
 * (`next`), so the same buttons and email link work for both doors.
 */
export function HostDoor() {
  const next = useSearchParams().get("next");
  const hosting = next === HOST_NEXT;

  if (hosting) {
    return (
      <p className="mt-5 text-center text-sm text-muted">
        <span className="text-fg/90">Sign in to set up your organisation.</span>{" "}
        <Link href="/login" replace className="underline-offset-4 transition-colors hover:text-fg hover:underline">
          Just looking for events?
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-5 text-center text-sm">
      <Link
        href={`/login?next=${encodeURIComponent(HOST_NEXT)}`}
        replace
        className="text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
      >
        Hosting events? Set up your organisation <span aria-hidden>→</span>
      </Link>
    </p>
  );
}
