import { describe, expect, it } from "vitest";
import { parseLumaDiscoverPage } from "./luma-discover";

const nextData = (initialData: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData } } })}</script></html>`;

describe("parseLumaDiscoverPage", () => {
  it("reads the current discover-place shape", () => {
    const html = nextData({
      kind: "discover-place",
      data: { place: { api_id: "discplace-QCcNk3HXowOR97j", slug: "london", name: "London", timezone: "Europe/London" } },
    });
    expect(parseLumaDiscoverPage(html, "london")).toEqual({
      apiId: "discplace-QCcNk3HXowOR97j",
      slug: "london",
      name: "London",
      timezone: "Europe/London",
      feedUrl: "https://api.lu.ma/ics/get?entity=discover&id=discplace-QCcNk3HXowOR97j",
    });
  });

  it("reads the older places / featured_place shape", () => {
    const html = nextData({
      places: [{ place: { api_id: "discplace-G0tGUVYwl7T17Sb", slug: "bengaluru", timezone: "Asia/Kolkata" } }],
      featured_place: { place: { api_id: "discplace-G0tGUVYwl7T17Sb", slug: "bengaluru", name: "Bengaluru", timezone: "Asia/Kolkata" } },
    });
    expect(parseLumaDiscoverPage(html, "bengaluru")?.feedUrl).toContain("discplace-G0tGUVYwl7T17Sb");
  });

  it("does not import a different city when the slug doesn't match", () => {
    const html = nextData({ data: { place: { api_id: "discplace-london", slug: "london", timezone: "Europe/London" } } });
    expect(parseLumaDiscoverPage(html, "bengaluru")).toBeNull();
  });

  it("returns null for missing, malformed or non-discover pages", () => {
    expect(parseLumaDiscoverPage("<html></html>", "london")).toBeNull();
    expect(parseLumaDiscoverPage('<script id="__NEXT_DATA__">{bad</script>', "london")).toBeNull();
    expect(parseLumaDiscoverPage(nextData({ data: { place: { api_id: "cal-123", slug: "london" } } }), "london")).toBeNull();
  });
});
