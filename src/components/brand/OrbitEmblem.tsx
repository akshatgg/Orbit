import Image from "next/image";

const RINGS = [
  { inset: "2%", cls: "emblem-spin-1", color: "rgb(169 155 255 / 0.6)", width: 1.25, dot: true },
  { inset: "-10%", cls: "emblem-spin-2", color: "rgb(255 255 255 / 0.28)", width: 1, dot: false },
  { inset: "-22%", cls: "emblem-spin-3", color: "rgb(242 164 119 / 0.4)", width: 1, dot: false },
];

/** The ORBIT mark floating over tilted orbit rings with a satellite and a soft glow. Pure CSS; static for reduced motion. */
export function OrbitEmblem({ size = 132 }: { size?: number }) {
  const box = size * 2;
  return (
    <div className="emblem-scene relative flex items-center justify-center" style={{ width: box, height: box }} aria-hidden>
      <div className="absolute rounded-full blur-3xl" style={{ width: size * 0.95, height: size * 0.95, background: "radial-gradient(circle, rgb(124 108 240 / 0.55), transparent 70%)" }} />

      {/* rings: flattened into a tilted plane */}
      <div className="emblem-plane absolute" style={{ width: size * 1.45, height: size * 1.45 }}>
        {RINGS.map((r) => (
          <div key={r.inset} className={`absolute rounded-full ${r.cls}`} style={{ inset: r.inset, border: `${r.width}px solid ${r.color}` }}>
            {r.dot && (
              <span
                className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                style={{ boxShadow: "0 0 12px 3px rgb(190 178 255 / 0.9), 0 0 28px 8px rgb(124 108 240 / 0.5)" }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="emblem-bob relative">
        <Image src="/brand/orbit-mark.png" alt="" width={size} height={size} priority className="drop-shadow-[0_14px_28px_rgb(0_0_0/0.55)]" />
      </div>

      {/* floor glow */}
      <div className="absolute rounded-full blur-xl" style={{ bottom: box * 0.1, width: size * 0.7, height: size * 0.12, background: "rgb(169 155 255 / 0.35)" }} />
    </div>
  );
}
