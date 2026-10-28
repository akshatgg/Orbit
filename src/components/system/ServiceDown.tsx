import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { Button } from "@/components/ui/Button";

/**
 * The page Orbit shows when it cannot reach its API.
 *
 * Deliberately not an empty state: a backend that is down is not "no events",
 * and pretending otherwise would hide an outage. It offers one action — try
 * again — because that is the only thing a visitor can actually do.
 */
export function ServiceDown({
  onRetry,
  title = "Orbit can't reach its server right now",
  detail = "This is usually a restart or a dropped connection. Nothing is lost — try again in a moment.",
}: {
  onRetry?: () => void;
  title?: string;
  detail?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <OrbitEmblem size={96} />

      <span className="mt-10 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-ink/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
        Service unavailable
      </span>

      <h1 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">{detail}</p>

      {onRetry && (
        <div className="mt-7">
          <Button onClick={onRetry} size="lg">
            Try again
          </Button>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">If this keeps happening, the Orbit team is already on it.</p>
    </main>
  );
}
