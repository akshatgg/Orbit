import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseMeetupFindPage, parseMeetupSearchResponse } from "./meetup-search";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

describe("parseMeetupFindPage", () => {
  it("reads the coordinates, filters and first cursor from the find page", () => {
    expect(parseMeetupFindPage(fixture("meetup-find.html"))).toEqual({
      lat: 12.970000267028809,
      lon: 77.58999633789062,
      startDateRange: "2026-10-20T12:05:59-04:00[US/Eastern]",
      indexAlias: '{"filterOutWrongLanguage": "true"}',
      categoryId: null,
      topicCategoryId: "652",
      endCursor: "NTA=",
      hasNextPage: true,
    });
  });

  it("returns null without the expected state", () => {
    expect(parseMeetupFindPage("<html></html>")).toBeNull();
    expect(parseMeetupFindPage('<script id="__NEXT_DATA__">{bad</script>')).toBeNull();
  });
});

describe("parseMeetupSearchResponse", () => {
  it("maps physical and online events, cleans prose and keeps the timezone", () => {
    const page = parseMeetupSearchResponse(JSON.parse(fixture("meetup-search.json")));
    expect(page.errors).toEqual([]);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBe("MzE2NTkyMjU2");
    expect(page.events).toHaveLength(2);

    expect(page.events[0]).toMatchObject({
      sourceEventId: "event_316719692@meetup.com",
      title: "Software Architects Meetup",
      startsAt: "2026-10-24T04:30:00.000Z",
      endsAt: null,
      timezone: "Asia/Kolkata",
      format: "in_person",
      venueName: "DevOn Software Services",
      address: "Embassy Tech Village, Outer Ring Road",
      latitude: null,
      longitude: null,
      url: "https://www.meetup.com/softwarearchitectsbangalore/events/316719692/",
      cancelled: false,
    });
    expect(page.events[0].description).toContain("Agenda for the day:");
    expect(page.events[0].description).toContain("• Welcome");

    expect(page.events[1]).toMatchObject({ format: "online", venueName: null, description: null });
  });

  it("reports a skipped row without dropping the rest", () => {
    const json = JSON.parse(fixture("meetup-search.json"));
    json.data.result.edges[0].node.eventUrl = null;
    const page = parseMeetupSearchResponse(json);
    expect(page.events).toHaveLength(1);
    expect(page.errors).toEqual([{ event: "316719692", message: "Skipped: missing id, title, start or event URL" }]);
  });

  it("surfaces GraphQL errors", () => {
    expect(parseMeetupSearchResponse({ errors: [{ message: "Nope" }] }).errors).toEqual([{ message: "Nope" }]);
  });
});
