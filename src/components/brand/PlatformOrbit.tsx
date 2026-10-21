import { OrbitEmblem } from "./OrbitEmblem";

// The event platforms ORBIT imports from, flowing into the ORBIT mark: "one app instead of four".
// Names only (no platform logos), so nothing reads as an official partnership.

const PLATFORMS = [
  { name: "Luma", x: 70, y: 48, path: "M70 48C140 48 170 110 220 160" },
  { name: "Meetup", x: 370, y: 48, path: "M370 48C300 48 270 110 220 160" },
  { name: "Eventbrite", x: 70, y: 272, path: "M70 272C140 272 170 210 220 160" },
  { name: "Fatsoma", x: 370, y: 272, path: "M370 272C300 272 270 210 220 160" },
];

const W = 440;
const H = 320;

// Dashes travel from each platform into the mark. Static for reduced motion.
const FLOW_CSS = `
@keyframes platform-flow { to { stroke-dashoffset: -32; } }
.platform-flow { animation: platform-flow 2.4s linear infinite; }
@media (prefers-reduced-motion: reduce) { .platform-flow { animation: none; } }
`;

export function PlatformOrbit() {
  return (
    <figure className="w-full max-w-[440px] pb-5 md:pb-0">
      <style href="platform-orbit" precedence="default">{FLOW_CSS}</style>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" fill="none">
          {PLATFORMS.map((p, i) => (
            <g key={p.name}>
              <path d={p.path} stroke="color-mix(in srgb, var(--ink) 16%, transparent)" strokeWidth={1.25} />
              <path
                d={p.path}
                className="platform-flow"
                stroke="var(--accent)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="2 14"
                style={{ animationDelay: `${i * -0.6}s` }}
              />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="scale-[0.72] min-[440px]:scale-100">
            <OrbitEmblem size={112} />
          </div>
        </div>

        {PLATFORMS.map((p) => (
          <span
            key={p.name}
            className="glass-strong absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-tight text-fg min-[440px]:px-3.5 min-[440px]:text-sm"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          >
            {p.name}
          </span>
        ))}
      </div>
      <figcaption className="mt-1 text-center text-sm font-medium text-muted">
        One app instead of four
        <span className="sr-only">: events from Luma, Meetup, Eventbrite and Fatsoma, all in ORBIT.</span>
      </figcaption>
    </figure>
  );
}
