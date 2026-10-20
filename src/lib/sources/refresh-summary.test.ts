import { describe, expect, it } from "vitest";
import { formatRefreshSummary } from "./refresh-summary";
import type { RefreshSummary, RunSummary } from "./types";

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  sourceId: "s", name: "S", status: "ok", found: 0, inserted: 0, updated: 0, unchanged: 0, flaggedMissing: 0, enriched: 0, errors: [], ...over,
});

const summary = (sources: RunSummary[], over: Partial<RefreshSummary> = {}): RefreshSummary => ({
  ok: true, startedAt: "", finishedAt: "", sources, expired: 0, duplicatesFlagged: 0, errors: [], ...over,
});

describe("formatRefreshSummary", () => {
  it("adds up every source", () => {
    const text = formatRefreshSummary(summary(
      [run({ inserted: 10, updated: 4, unchanged: 20, enriched: 9 }), run({ inserted: 2 }), run({ status: "error" })],
      { duplicatesFlagged: 1 },
    ));
    expect(text).toBe("3 sources · 12 new · 4 updated · 20 unchanged · 9 with page details · 1 possible duplicate · 1 failed");
  });

  it("keeps it short when nothing happened", () => {
    expect(formatRefreshSummary(summary([run()]))).toBe("1 source · 0 new · 0 updated · 0 unchanged");
    expect(formatRefreshSummary(summary([]))).toBe("0 sources · 0 new · 0 updated · 0 unchanged");
  });
});
