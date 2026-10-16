import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { formatEventDate } from "@/lib/format";
import { SITE_TAGLINE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

let markPromise: Promise<string> | undefined;
/** The ORBIT mark as a data URI (read once). */
function mark() {
  markPromise ??= readFile(path.join(process.cwd(), "public/brand/orbit-mark.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`,
  );
  return markPromise;
}

const BG = "#0c0d10";

export async function defaultOgImage() {
  const src = await mark();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BG, color: "#f2f3f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={260} height={260} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: 24 }}>ORBIT</div>
            <div style={{ fontSize: 34, color: "#6d95ff", letterSpacing: 8, textTransform: "uppercase", marginTop: 8 }}>{SITE_TAGLINE}</div>
            <div style={{ fontSize: 28, color: "#8e929b", marginTop: 28 }}>Career events, networking &amp; socials</div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

export async function eventOgImage(e: { title: string; starts_at: string; city: string | null; venue_name: string | null; format: string; organiser: { name: string } | null; status: string }) {
  const src = await mark();
  const where = e.format === "online" ? "Online" : (e.venue_name ?? e.city ?? "");
  const title = e.title.length > 90 ? `${e.title.slice(0, 87)}…` : e.title;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: BG, color: "#f2f3f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={64} height={64} alt="" />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>ORBIT</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {e.status === "cancelled" && <div style={{ fontSize: 30, color: "#fca5a5", marginBottom: 16 }}>CANCELLED</div>}
          <div style={{ fontSize: title.length > 50 ? 62 : 76, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 34, color: "#6d95ff", marginTop: 28 }}>{`${formatEventDate(e.starts_at)}${where ? ` · ${where}` : ""}`}</div>
          {e.organiser && <div style={{ fontSize: 28, color: "#8e929b", marginTop: 12 }}>{`by ${e.organiser.name}`}</div>}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
