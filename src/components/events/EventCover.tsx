/* eslint-disable @next/next/no-img-element */

/** Event cover image, or a branded gradient when the organiser didn't upload one. */
export function EventCover({ src, title, className = "" }: { src?: string | null; title: string; className?: string }) {
  if (src) return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-2 ${className}`} aria-hidden>
      <div className="bg-gradient absolute inset-0 opacity-25" />
      <span className="relative px-3 text-center font-display text-xs font-semibold uppercase tracking-[0.25em] text-fg/70">
        {title.split(" ").slice(0, 3).join(" ")}
      </span>
    </div>
  );
}
