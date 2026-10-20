import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLumaEventPage, parseLumaLinkedEvent } from "./luma-page";

const page = readFileSync(fileURLToPath(new URL("./__fixtures__/luma-event.html", import.meta.url)), "utf8");

const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;

describe("parseLumaEventPage", () => {
  it("reads cover, full description and price from the real page", () => {
    const details = parseLumaEventPage(page);
    expect(details).not.toBeNull();
    expect(details!.coverUrl).toMatch(/^https:\/\/cdn\.lu\.ma\/.*event-covers\/is\/b1513072-d1d5-4d13-8d81-9ed02b4c4d03/);
    expect(details!.description).toMatch(/^Did you know that the Internet Archive now has a Canadian edition\?/);
    expect(details!.description!.length).toBeGreaterThan(1000);
    expect(details).toMatchObject({ priceMin: 0, priceMax: 0, currency: "USD" });
  });

  it("falls back to og:image when there is no JSON-LD", () => {
    const html = page.replace(/<script[^>]*application\/ld\+json[\s\S]*?<\/script>/, "");
    const details = parseLumaEventPage(html);
    expect(details?.coverUrl).toMatch(/^https:\/\/cdn\.lu\.ma\//);
    expect(details?.description).toBeNull();
    expect(details?.priceMin).toBeNull();
  });

  it("ignores images on other hosts", () => {
    expect(parseLumaEventPage(ld({ "@type": "Event", image: ["https://evil.example.com/a.jpg"] }))).toBeNull();
  });

  it("gives a price range for several offers in one currency", () => {
    const details = parseLumaEventPage(ld({
      "@type": "Event",
      offers: [{ price: 5, priceCurrency: "gbp" }, { price: "12.5", priceCurrency: "GBP" }],
    }));
    expect(details).toMatchObject({ priceMin: 5, priceMax: 12.5, currency: "GBP" });
  });

  it("gives no price for mixed currencies or missing prices", () => {
    expect(parseLumaEventPage(ld({ "@type": "Event", description: "x", offers: [{ price: 5, priceCurrency: "GBP" }, { price: 5, priceCurrency: "USD" }] }))?.priceMin).toBeNull();
    expect(parseLumaEventPage(ld({ "@type": "Event", description: "x", offers: [{ priceCurrency: "GBP" }] }))?.priceMin).toBeNull();
  });

  it("finds the Event inside an array and skips malformed blocks", () => {
    const html = `<script type="application/ld+json">{not json</script>${ld([{ "@type": "Organization" }, { "@type": "Event", description: "<p>Hi &amp; welcome</p>" }])}`;
    expect(parseLumaEventPage(html)?.description).toBe("Hi & welcome");
  });

  it("returns null for pages with nothing useful", () => {
    expect(parseLumaEventPage("<html><body>Not found</body></html>")).toBeNull();
    expect(parseLumaEventPage("")).toBeNull();
  });
});

describe("parseLumaLinkedEvent", () => {
  it("turns a single event page into an ORBIT event", () => {
    expect(parseLumaLinkedEvent(page, "https://luma.com/van-dweb-social")).toMatchObject({
      sourceEventId: "link-van-dweb-social",
      title: "Vancouver DWeb Social",
      startsAt: "2023-01-26T02:00:00.000Z",
      endsAt: "2023-01-26T04:30:00.000Z",
      timezone: "Europe/London",
      format: "in_person",
      venueName: "The Permanent Library Limited",
      latitude: 49.282399,
      longitude: -123.111574,
      url: "https://luma.com/van-dweb-social",
      cancelled: false,
    });
  });

  it("uses the event api id when the page exposes it", () => {
    const html = page.replace("</head>", '<script>{"api_id":"evt-abc123"}</script></head>');
    expect(parseLumaLinkedEvent(html, "https://luma.com/van-dweb-social")?.sourceEventId).toBe("evt-abc123");
  });

  it("returns null without event JSON-LD", () => {
    expect(parseLumaLinkedEvent("<html></html>", "https://luma.com/van-dweb-social")).toBeNull();
  });
});
