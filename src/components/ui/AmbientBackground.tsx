const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Fixed ambient light behind every screen: three slow, soft orbs and a faint film grain. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="ambient-orb ambient-a"
        style={{ left: "-20vw", top: "-18vh", width: "70vw", height: "70vw", maxWidth: 760, maxHeight: 760, background: "#7c6cf0", opacity: 0.2 }}
      />
      <div
        className="ambient-orb ambient-b"
        style={{ right: "-25vw", top: "18vh", width: "65vw", height: "65vw", maxWidth: 700, maxHeight: 700, background: "#3f6ff0", opacity: 0.17 }}
      />
      <div
        className="ambient-orb ambient-c"
        style={{ left: "5vw", bottom: "-24vh", width: "60vw", height: "60vw", maxWidth: 680, maxHeight: 680, background: "#f2a477", opacity: 0.14 }}
      />
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
