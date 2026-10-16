import { describe, expect, it } from "vitest";
import { orbitLoaderMetrics } from "./orbit-loader-sizes";

describe("orbitLoaderMetrics", () => {
  it("grows monotonically with size", () => {
    const [sm, md, lg] = (["sm", "md", "lg"] as const).map(orbitLoaderMetrics);
    expect(sm.mark).toBeLessThan(md.mark);
    expect(md.mark).toBeLessThan(lg.mark);
    expect(lg.word).toBeGreaterThan(sm.word);
  });

  it("leaves room for rings around the mark", () => {
    for (const s of ["sm", "md", "lg"] as const) {
      const m = orbitLoaderMetrics(s);
      expect(m.scene).toBeGreaterThan(m.mark * 1.5);
    }
  });
});
