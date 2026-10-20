import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAllSources, runSource } from "./engine";

// Opt-in: hits the live Meetup/Luma pages and the local Supabase instance.
//   set -a; source .env.development.local; set +a
//   RUN_DISCOVERY_E2E=1 npx vitest run src/lib/sources/discovery.e2e.test.ts
const enabled = process.env.RUN_DISCOVERY_E2E === "1";

const LUMA_CITY = "https://lu.ma/bengaluru";
const LUMA_EVENT = "https://luma.com/van-dweb-social";
const MEETUP_SEARCH = "https://www.meetup.com/find/?location=in--Bengaluru&source=EVENTS";
const MEETUP_NO_LOCATION = "https://www.meetup.com/find/?categoryId=652&source=EVENTS";
const MEETUP_EVENT = "https://www.meetup.com/london-software-craftsmanship/events/317008447/";

describe.skipIf(!enabled)("discovery sources end to end", () => {
  function client() {
    return createAdminClient();
  }

  async function ensureSource(db: ReturnType<typeof client>, kind: string, url: string, name: string) {
    const { data, error } = await db
      .from("event_sources")
      .upsert(
        { name, kind, url, permission_confirmed: true, permission_note: "Local discovery test", enabled: true },
        { onConflict: "kind,url" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function countEvents(db: ReturnType<typeof client>, sourceId: string) {
    const { count, error } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("source", `source:${sourceId}`);
    if (error) throw error;
    return count ?? 0;
  }

  it("imports a Luma city and a Meetup search, and a single Meetup event", async () => {
    const db = client();
    // Older test sources (e.g. a 50-event London city) must not run inside this test.
    await db.from("event_sources").update({ enabled: false }).in("kind", ["luma-discover", "meetup-search"]);
    const lumaId = await ensureSource(db, "luma-discover", LUMA_CITY, "Luma Bengaluru (e2e)");
    const meetupSearchId = await ensureSource(db, "meetup-search", MEETUP_SEARCH, "Meetup Bengaluru search (e2e)");
    const meetupEventId = await ensureSource(db, "meetup-search", MEETUP_EVENT, "Meetup single event (e2e)");

    const summary = await refreshAllSources({ trigger: "manual" });
    expect(summary.errors).toEqual([]);
    expect(summary.sources.find((s) => s.sourceId === lumaId)?.status).toBe("ok");
    expect(summary.sources.find((s) => s.sourceId === meetupSearchId)?.status).toBe("ok");

    expect(await countEvents(db, lumaId)).toBeGreaterThan(5);
    expect(await countEvents(db, meetupSearchId)).toBeGreaterThan(5);

    // The Luma city feed always carries GEO, so these events are mappable immediately.
    const { data: luma, error: lumaError } = await db
      .from("events")
      .select("title, latitude, longitude, timezone")
      .eq("source", `source:${lumaId}`)
      .limit(5);
    if (lumaError) throw lumaError;
    expect(luma!.length).toBeGreaterThan(0);
    expect(luma!.every((e) => e.latitude !== null && e.longitude !== null)).toBe(true);
    expect(luma![0].timezone).toBe("Asia/Kolkata");

    // The old DB default (London) must not leak into an Indian search.
    const { data: meetupCities, error: cityError } = await db
      .from("events")
      .select("city")
      .eq("source", `source:${meetupSearchId}`)
      .limit(250);
    if (cityError) throw cityError;
    expect(meetupCities!.some((e) => /bengaluru|bangalore/i.test(e.city ?? ""))).toBe(true);
    expect(meetupCities!.every((e) => e.city !== "London")).toBe(true);

    const single = await runSource(meetupEventId, { trigger: "manual" });
    expect(single.status).toBe("ok");
    expect(single.found).toBe(1);
    expect(single.inserted + single.unchanged).toBe(1);

    const { data: event, error: eventError } = await db
      .from("events")
      .select("title, venue_name, address, city, latitude, longitude, source_event_id")
      .eq("source", `source:${meetupEventId}`)
      .single();
    if (eventError) throw eventError;
    expect(event).toMatchObject({
      title: "The Hottest New Programming Language is Ubiquitous",
      venue_name: "Codurance",
      address: "3 Sutton Lane",
      city: "London",
      source_event_id: "event_317008447@meetup.com",
    });
    expect(event!.latitude).not.toBeNull();
    expect(event!.longitude).not.toBeNull();

    // Re-running the large search must not duplicate rows.
    const before = await countEvents(db, meetupSearchId);
    const again = await runSource(meetupSearchId, { trigger: "manual" });
    expect(again.status).toBe("ok");
    expect(again.inserted).toBe(0);
    expect(await countEvents(db, meetupSearchId)).toBe(before);
  }, 180_000);

  it("imports a Meetup find link with no location parameter", async () => {
    const db = client();
    const id = await ensureSource(db, "meetup-search", MEETUP_NO_LOCATION, "Meetup no-location (e2e)");
    await db.from("event_sources").update({ enabled: false }).in("kind", ["luma-discover", "meetup-search"]).neq("id", id);
    await db.from("event_sources").update({ enabled: true }).eq("id", id);

    const result = await runSource(id, { trigger: "manual" });
    expect(result.status).toBe("ok");
    expect(result.found).toBeGreaterThan(0);
    expect(await countEvents(db, id)).toBeGreaterThan(0);

    // Clean up this one-off source and its rows.
    await db.from("events").delete().eq("source", `source:${id}`);
    await db.from("event_sources").delete().eq("id", id);
  }, 90_000);

  it("imports a single Luma event link with its venue, city and coordinates", async () => {
    const db = client();
    const singleLumaId = await ensureSource(db, "luma-discover", LUMA_EVENT, "Luma single event (e2e)");
    await db.from("event_sources").update({ enabled: false }).in("kind", ["luma-discover", "meetup-search"]).neq("id", singleLumaId);
    await db.from("event_sources").update({ enabled: true }).eq("id", singleLumaId);

    const single = await runSource(singleLumaId, { trigger: "manual" });
    expect(single.status).toBe("ok");
    expect(single.found).toBe(1);
    const { data: event, error: eventError } = await db
      .from("events")
      .select("title, venue_name, address, city, latitude, longitude, source_event_id")
      .eq("source", `source:${singleLumaId}`)
      .single();
    if (eventError) throw eventError;
    expect(event).toMatchObject({
      title: "Vancouver DWeb Social",
      venue_name: "The Permanent Library Limited",
      address: "The Permanent Library Limited",
      city: "Vancouver",
      latitude: 49.282399,
      longitude: -123.111574,
    });
    expect(event!.source_event_id).toBeTruthy();
  }, 60_000);
});
