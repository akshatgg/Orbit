/* eslint-disable @next/next/no-img-element */

/** Round image with initials fallback. Plain <img> so any storage URL works. */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const style = { width: size, height: size };
  return src ? (
    <img src={src} alt="" style={style} className="shrink-0 rounded-full border border-white/10 object-cover" />
  ) : (
    <span style={{ ...style, fontSize: size * 0.38 }} className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] font-semibold text-muted">
      {initials}
    </span>
  );
}
