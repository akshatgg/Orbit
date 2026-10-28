"use client";

import { useEffect } from "react";

import { ServiceDown } from "@/components/system/ServiceDown";

/**
 * The route-level error boundary shared by the app and the admin console.
 *
 * The backend being unreachable is the common case, so it gets its own copy;
 * anything else is reported as a generic problem and still offers a retry.
 * `next dev` overlays its own error dialog on top — that is a developer tool;
 * in production this component is what a visitor sees.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[orbit] page failed to render:", error);
  }, [error]);

  const unreachable = /cannot reach the orbit api|fetch failed|econnrefused|etimedout/i.test(error.message);

  return (
    <ServiceDown
      onRetry={reset}
      title={unreachable ? undefined : "Something went wrong on this page"}
      detail={
        unreachable
          ? undefined
          : "The page could not be loaded. Trying again usually fixes it; if it doesn't, the Orbit team can see the error."
      }
    />
  );
}
