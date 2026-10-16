/* eslint-disable @next/next/no-img-element */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Event cover image, or a calm mesh gradient derived from the title when there isn't one. */
export function EventCover({ src, title, className = "" }: { src?: string | null; title: string; className?: string }) {
  if (src) return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} />;
  const h = hash(title);
  const base = h % 360;
  const h2 = (base + 40 + ((h >> 8) % 50)) % 360;
  const h3 = (base + 200 + ((h >> 16) % 60)) % 360;
  const at = (n: number) => 15 + ((h >> n) % 70);
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{
        backgroundColor: `hsl(${base} 30% 11%)`,
        backgroundImage: [
          `radial-gradient(70% 70% at ${at(3)}% ${at(5)}%, hsl(${base} 45% 34% / 0.85), transparent 70%)`,
          `radial-gradient(65% 65% at ${at(7)}% ${at(11)}%, hsl(${h2} 42% 30% / 0.8), transparent 70%)`,
          `radial-gradient(60% 60% at ${at(13)}% ${at(17)}%, hsl(${h3} 40% 28% / 0.7), transparent 70%)`,
        ].join(","),
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="relative h-1/4 w-1/4 min-h-5 min-w-5 text-white/55" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" />
    </div>
  );
}
