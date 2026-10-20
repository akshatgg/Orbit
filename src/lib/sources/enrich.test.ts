import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./fetch", async (orig) => ({ ...(await orig<typeof import("./fetch")>()), fetchFeedText: vi.fn() }));
vi.mock("./cloudinary-import", () => ({ importRemoteImage: vi.fn() }));
vi.mock("./luma-page", () => ({ parseLumaEventPage: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ getCloudinaryConfig: vi.fn() }));

import { getCloudinaryConfig } from "@/lib/cloudinary";
import { importRemoteImage } from "./cloudinary-import";
import { enrichLumaEvents } from "./enrich";
import { PAGE_WORST_CASE_MS, type EnrichRunState } from "./enrich-plan";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseLumaEventPage } from "./luma-page";
import type { RunError } from "./types";

// A tiny stand-in for the Supabase client: every builder call is recorded and chains on,
// and awaiting the chain gives the preset rows for that table.
type Call = { table: string; method: string; args: unknown[] };

function fakeDb(events: unknown[]) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const made: Call[] = [];
    const builder: Record<string, unknown> = {
      then: (resolve: (r: { data: unknown[]; error: null }) => unknown) => {
        const isUpdate = made.some((c) => c.method === "update");
        const data = table === "events" ? (isUpdate ? [{ id: "row" }] : events) : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    for (const method of ["select", "eq", "gt", "order", "limit", "in", "is", "update", "upsert"]) {
      builder[method] = (...args: unknown[]) => {
        const call = { table, method, args };
        made.push(call);
        calls.push(call);
        return builder;
      };
    }
    return builder;
  };
  const recorded = (table: string, method: string) => calls.filter((c) => c.table === table && c.method === method);
  return { db: { from } as unknown as SupabaseClient, calls, recorded };
}

const event = (id: string) => ({
  id,
  source_event_id: `evt-${id}@events.lu.ma`,
  external_url: `https://luma.com/${id}`,
  starts_at: "2026-10-28T18:00:00+00:00",
  created_at: "2026-10-19T03:00:00+00:00",
  cover_url: null,
  description: null,
  price_min: null,
});

const NOW = new Date("2026-10-20T03:00:00Z");
const run = (over: Partial<EnrichRunState> = {}): EnrichRunState => ({ deadline: Date.now() + 200_000, lumaBlocked: false, ...over });
const page = { description: "A great night", coverUrl: "https://cdn.lu.ma/cover.jpg", priceMin: null, priceMax: null, currency: null };
const statuses = (upserts: Call[]) => upserts.map((c) => (c.args[0] as { status: string }).status);

beforeEach(() => {
  vi.resetAllMocks();
  // Skip the 1 s pause between pages.
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);
  vi.mocked(getCloudinaryConfig).mockReturnValue({ cloudName: "c", apiKey: "k", apiSecret: "s" });
  vi.mocked(parseLumaEventPage).mockReturnValue(page);
  vi.mocked(fetchFeedText).mockResolvedValue("<html></html>");
  vi.mocked(importRemoteImage).mockResolvedValue("https://res.cloudinary.com/c/cover.jpg");
});

describe("enrichLumaEvents", () => {
  it("stops the whole run when Luma blocks a page read", async () => {
    vi.mocked(fetchFeedText).mockRejectedValue(new FetchHttpError("HTTP 403", 403));
    const { db, recorded } = fakeDb([event("a"), event("b")]);
    const errors: RunError[] = [];
    const state = run();

    const saved = await enrichLumaEvents({ id: "s1" }, { db, now: NOW, errors, run: state });

    expect(saved).toBe(0);
    expect(state.lumaBlocked).toBe(true);
    expect(fetchFeedText).toHaveBeenCalledTimes(1);
    expect(statuses(recorded("source_event_details", "upsert"))).toEqual(["blocked"]);
    expect(errors).toEqual([{ message: "Luma is blocking page reads. Paste or upload images for now." }]);
  });

  it("reads nothing when Luma is already blocking this run", async () => {
    const { db, calls } = fakeDb([event("a")]);

    const saved = await enrichLumaEvents({ id: "s1" }, { db, now: NOW, errors: [], run: run({ lumaBlocked: true }) });

    expect(saved).toBe(0);
    expect(fetchFeedText).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("reads nothing when the run deadline is too close for another page", async () => {
    const { db, recorded } = fakeDb([event("a")]);

    const saved = await enrichLumaEvents({ id: "s1" }, { db, now: NOW, errors: [], run: run({ deadline: Date.now() + PAGE_WORST_CASE_MS - 1000 }) });

    expect(saved).toBe(0);
    expect(fetchFeedText).not.toHaveBeenCalled();
    expect(recorded("source_event_details", "upsert")).toHaveLength(0);
  });

  it("records ok and still saves the description when the cover import fails", async () => {
    vi.mocked(importRemoteImage).mockRejectedValue(new Error("Image too large"));
    const { db, recorded } = fakeDb([event("a")]);
    const errors: RunError[] = [];

    const saved = await enrichLumaEvents({ id: "s1" }, { db, now: NOW, errors, run: run() });

    expect(saved).toBe(1);
    const [upsert] = recorded("source_event_details", "upsert");
    expect(upsert.args[0]).toMatchObject({ status: "ok", last_error: "Image too large" });
    expect(recorded("events", "update").map((c) => c.args[0])).toEqual([{ description: "A great night" }]);
    expect(errors).toEqual([{ event: "evt-a@events.lu.ma", message: "Cover not imported: Image too large" }]);
  });

  it("skips covers once, with one error, when Cloudinary isn't configured", async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(null);
    const { db, recorded } = fakeDb([event("a"), event("b")]);
    const errors: RunError[] = [];

    const saved = await enrichLumaEvents({ id: "s1" }, { db, now: NOW, errors, run: run() });

    expect(saved).toBe(2);
    expect(importRemoteImage).not.toHaveBeenCalled();
    expect(statuses(recorded("source_event_details", "upsert"))).toEqual(["ok", "ok"]);
    expect(recorded("events", "update").map((c) => c.args[0])).toEqual([{ description: "A great night" }, { description: "A great night" }]);
    expect(errors).toEqual([{ message: "Image import needs Cloudinary (CLOUDINARY_* env vars are missing), so covers were skipped." }]);
  });
});
