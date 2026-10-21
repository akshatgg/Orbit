import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseMeetupLinkedEvent } from "./meetup-page";
import { expandSeries, meetupEventId, meetupSeriesKey, parseMeetupSeriesResponse, withSeriesDates, type MeetupSeries } from "./meetup-series";
import type { RunError } from "./types";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
const URL_ = "https://www.meetup.com/mohali-business-networking-community/events/316894987/";
const KEY = "meetup:mohali-business-networking-community:business networking referral meetup 5 pm";
const NOW = new Date("2026-10-21T12:00:00Z");

// Real Meetup data: the event page and its series lookup.
const base = parseMeetupLinkedEvent(fixture("meetup-business-event.html"), URL_)!;
const series = parseMeetupSeriesResponse(JSON.parse(fixture("meetup-series.json")))!;

describe("parseMeetupSeriesResponse", () => {
  it("reads the label and every date with its own link (real response)", () => {
    expect(series.label).toBe("Every week on Wednesday until December 10, 2026");
    expect(series.dates).toHaveLength(7);
    expect(series.dates[0]).toEqual({
      id: "316894987", startsAt: "2026-10-28T11:30:00.000Z", endsAt: "2026-10-28T12:30:00.000Z", url: URL_, cancelled: false,
    });
    expect(series.dates[1]).toMatchObject({ id: "fbrkztyjcpbgb", startsAt: "2026-11-04T11:30:00.000Z" });
  });

  it("is null for a one-off event", () => {
    expect(parseMeetupSeriesResponse({ data: { event: { series: null } } })).toBeNull();
    expect(parseMeetupSeriesResponse(null)).toBeNull();
  });
});

describe("expandSeries", () => {
  it("makes one event per date, sharing the series key and label (real page + response)", () => {
    expect(base.seriesLabel).toBe("Every week on Wednesday until December 10, 2026");
    const dates = expandSeries(base, series, NOW);
    expect(dates.map((d) => d.startsAt.slice(0, 10))).toEqual([
      "2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09",
    ]);
    expect(dates[1]).toMatchObject({
      sourceEventId: "event_fbrkztyjcpbgb@meetup.com",
      url: "https://www.meetup.com/mohali-business-networking-community/events/fbrkztyjcpbgb/",
      endsAt: "2026-11-04T12:30:00.000Z",
      title: base.title,
      description: base.description,
      format: "online",
      seriesKey: KEY,
      seriesLabel: "Every week on Wednesday until December 10, 2026",
    });
  });

  it("drops dates that ended over a day ago, so the next date leads", () => {
    const afterOct28 = new Date("2026-10-30T12:00:00Z");
    expect(expandSeries(base, series, afterOct28)[0].startsAt).toBe("2026-11-04T11:30:00.000Z");
  });

  it("carries a cancelled date as cancelled (the sync only flags it)", () => {
    const withCancel: MeetupSeries = { ...series, dates: series.dates.map((d, i) => (i === 2 ? { ...d, cancelled: true } : d)) };
    expect(expandSeries(base, withCancel, NOW)[2].cancelled).toBe(true);
  });
});

describe("withSeriesDates", () => {
  it("expands series once and leaves one-off events alone", async () => {
    const calls: string[] = [];
    const lookup = async (id: string) => (calls.push(id), series);
    const oneOff = { ...base, sourceEventId: "event_1@meetup.com", title: "One-off talk", seriesLabel: null };
    const later = { ...base, sourceEventId: "event_fbrkztyjcpbgb@meetup.com", startsAt: "2026-11-04T11:30:00.000Z" };
    const out = await withSeriesDates([base, oneOff, later], { now: NOW, referer: URL_, errors: [], lookup, pauseMs: 0 });
    expect(calls).toEqual(["316894987"]);
    expect(out).toHaveLength(8); // 7 dates + the one-off
    expect(new Set(out.map((e) => e.sourceEventId)).size).toBe(8);
  });

  it("keeps the single date, grouped, when the lookup fails", async () => {
    const errors: RunError[] = [];
    const lookup = async () => {
      throw new Error("HTTP 503");
    };
    const out = await withSeriesDates([base], { now: NOW, referer: URL_, errors, lookup, pauseMs: 0 });
    expect(out).toEqual([{ ...base, seriesKey: KEY }]);
    expect(errors[0].message).toContain("HTTP 503");
  });
});

describe("ids and keys", () => {
  it("reads numeric and temporary Meetup ids, and keys a series by group and title", () => {
    expect(meetupEventId("event_316894987@meetup.com")).toBe("316894987");
    expect(meetupEventId("event_fbrkztyjcpbgb@meetup.com")).toBe("fbrkztyjcpbgb");
    expect(meetupEventId("uid-123@luma.com")).toBeNull();
    expect(meetupSeriesKey(base)).toBe(KEY);
  });
});
