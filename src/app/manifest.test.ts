import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const m = manifest();
const pub = (src: string) => join(process.cwd(), "public", src);

describe("web app manifest", () => {
  it("has the required and recommended members", () => {
    for (const k of ["name", "short_name", "description", "id", "start_url", "scope", "display", "orientation", "lang", "dir"] as const) {
      expect(m[k], k).toBeTruthy();
    }
    expect(m.short_name!.length).toBeGreaterThanOrEqual(3);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.prefer_related_applications).toBe(false);
    expect(m.launch_handler?.client_mode).toContain("navigate-existing");
    expect(m.edge_side_panel?.preferred_width).toBe(420);
    expect(m.share_target?.action).toBe("/search");
  });

  it("uses separate any and maskable PNG icons including a 512 one", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => (i.purpose as string | undefined) === "any maskable")).toBe(false);
    expect(icons.some((i) => i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.type === "image/png")).toBe(true);
    for (const i of icons) {
      expect(i.type).toBe("image/png");
      expect(existsSync(pub(i.src)), i.src).toBe(true);
    }
  });

  it("has narrow and wide screenshots that exist on disk", () => {
    const shots = m.screenshots ?? [];
    expect(shots.filter((s) => s.form_factor === "narrow").length).toBeGreaterThanOrEqual(2);
    expect(shots.filter((s) => s.form_factor === "wide").length).toBeGreaterThanOrEqual(1);
    for (const s of shots) {
      expect(s.label).toBeTruthy();
      expect(s.type).toBe("image/png");
      expect(existsSync(pub(s.src)), s.src).toBe(true);
    }
  });

  it("has shortcuts with PNG icons only", () => {
    const shortcuts = m.shortcuts ?? [];
    expect(shortcuts.length).toBeGreaterThan(0);
    for (const s of shortcuts) {
      expect(s.name && s.url).toBeTruthy();
      expect(s.icons?.length).toBeGreaterThan(0);
      for (const i of s.icons!) {
        expect(i.src).not.toMatch(/\.(webp|svg)$/);
        expect(i.type).toBe("image/png");
        expect(existsSync(pub(i.src)), i.src).toBe(true);
      }
    }
  });
});
