import { orbitLoaderMetrics, type OrbitLoaderSize } from "./orbit-loader-sizes";
import { OrbitLogo } from "@/components/brand/OrbitLogo";

const RINGS = [
  { scale: 1.0, cls: "loader-spin-1", color: "rgb(190 178 255 / 0.9)", width: 1.5, dot: true },
  { scale: 1.32, cls: "loader-spin-2", color: "rgb(222 159 251 / 0.5)", width: 1, dot: false },
  { scale: 1.64, cls: "loader-spin-3", color: "rgb(253 181 112 / 0.55)", width: 1, dot: false },
];

interface OrbitLoaderProps {
  size?: OrbitLoaderSize;
  /** Centre in the full viewport height. Without it the loader fills its parent's width only. */
  fullscreen?: boolean;
  /** Screen-reader text announced while loading. */
  label?: string;
  /** Optional visible caption under the wordmark. */
  caption?: string;
  className?: string;
}

/** Branded ORBIT loading state: breathing mark, tilted orbit rings with a satellite, shimmering wordmark. CSS-only, so it renders from the server. */
export function OrbitLoader({ size = "md", fullscreen = false, label = "Loading", caption, className = "" }: OrbitLoaderProps) {
  const { mark, scene, word } = orbitLoaderMetrics(size);
  const ring = mark * 1.2;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center ${fullscreen ? "min-h-dvh" : ""} ${className}`}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col items-center">
        <div className="loader-scene relative flex items-center justify-center" style={{ width: scene, height: scene * 0.86 }}>
          <div
            className="loader-glow absolute rounded-full blur-2xl"
            style={{ width: mark * 1.5, height: mark * 1.5, background: "radial-gradient(circle, rgb(124 108 240 / 0.6), rgb(222 159 251 / 0.15) 55%, transparent 72%)" }}
          />
          <div className="loader-plane absolute" style={{ width: ring, height: ring }}>
            {RINGS.map((r) => (
              <div
                key={r.scale}
                className={`absolute rounded-full ${r.cls}`}
                style={{ inset: `${((1 - r.scale) / 2) * 100}%`, border: `${r.width}px solid ${r.color}` }}
              >
                {r.dot && (
                  <span
                    className="absolute left-1/2 top-0 rounded-full bg-white"
                    style={{
                      width: Math.max(5, mark * 0.075),
                      height: Math.max(5, mark * 0.075),
                      transform: "translate(-50%, -50%)",
                      boxShadow: "0 0 10px 3px rgb(190 178 255 / 0.9), 0 0 26px 8px rgb(124 108 240 / 0.55)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="loader-breathe relative">
            <OrbitLogo size={mark} priority className="drop-shadow-[0_10px_24px_rgb(0_0_0/0.55)]" />
          </div>
        </div>

        <span
          className="loader-word font-display font-semibold uppercase"
          style={{ fontSize: word, letterSpacing: "0.5em", paddingLeft: "0.5em", marginTop: size === "sm" ? 2 : 6 }}
        >
          Orbit
        </span>
        {caption && <p className="mt-3 text-center text-[13px] text-muted">{caption}</p>}
      </div>
    </div>
  );
}
