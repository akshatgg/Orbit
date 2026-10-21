import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lumaMirrorDescription, parseLumaEventPage, parseLumaLinkedEvent } from "./luma-page";

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

  it("reads the venue's country, as a code or a Country object", () => {
    const formatted = readFileSync(fileURLToPath(new URL("./__fixtures__/luma-event-formatted.html", import.meta.url)), "utf8");
    expect(parseLumaEventPage(formatted)?.country).toBe("IN");
    const named = ld({ "@type": "Event", description: "x", location: { address: { addressCountry: { "@type": "Country", name: "India" } } } });
    expect(parseLumaEventPage(named)?.country).toBe("India");
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

describe("lumaMirrorDescription", () => {
  const formatted = readFileSync(fileURLToPath(new URL("./__fixtures__/luma-event-formatted.html", import.meta.url)), "utf8");
  const withDoc = (doc: unknown) =>
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData: { data: { description_mirror: doc } } } } })}</script>`;
  const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
  const para = (...content: unknown[]) => ({ type: "paragraph", content });

  it("keeps the host's headings, paragraphs, bold and lists (real Luma page)", () => {
    const description = lumaMirrorDescription(formatted)!;
    expect(description.startsWith("**Embedded Swift: From Code to Hardware**\n\nJoin us for a hands-on **Embedded Swift workshop** where")).toBe(true);
    expect(description).toContain("**Saturday, 24 October 2026**\n**9:30 AM – 1:00 PM**");
    expect(description).toContain("What we’ll cover\n\n• Introduction to Embedded Swift\n• Setting up the Embedded Swift development environment on macOS\n");
    expect(description).toContain("This workshop is suitable for:\n\n• Swift and iOS developers curious about embedded systems\n");
    expect(description.endsWith("Organized by **SwiftBengaluru**.")).toBe(true);
  });

  it("is what both page readers store, instead of the flattened JSON-LD copy", () => {
    expect(parseLumaEventPage(formatted)?.description).toBe(lumaMirrorDescription(formatted));
    expect(parseLumaLinkedEvent(formatted, "https://luma.com/lbm2afcr")?.description).toBe(lumaMirrorDescription(formatted));
  });

  it("numbers ordered lists, keeps links and line breaks, merges split bold and keeps spaces outside markers", () => {
    const doc = {
      type: "doc",
      content: [
        para(text("Hello "), text("big ", [{ type: "bold" }]), text("world", [{ type: "bold" }]), text(" and "), text("soft", [{ type: "italic" }])),
        para(text("Line one"), { type: "hard_break" }, text("Line two")),
        para(text("Tickets", [{ type: "link", attrs: { href: "https://example.com/t" } }]), text(" · "), text("https://example.com", [{ type: "link", attrs: { href: "https://example.com" } }])),
        { type: "ordered_list", attrs: { order: 1 }, content: [{ type: "list_item", content: [para(text("First"))] }, { type: "list_item", content: [para(text("Second"))] }] },
        { type: "horizontal_rule" },
        { type: "blockquote", content: [para(text("Quoted"))] },
      ],
    };
    expect(lumaMirrorDescription(withDoc(doc))).toBe(
      "Hello **big world** and *soft*\n\nLine one\nLine two\n\nTickets (https://example.com/t) · https://example.com\n\n1. First\n2. Second\n\nQuoted",
    );
  });

  it("reads Luma's own categories as strong interest hints", () => {
    const html = withDoc({ type: "doc", content: [] }).replace('"description_mirror"', '"categories":[{"api_id":"cat-tech","name":"Tech"},{"api_id":"cat-ai","name":"AI"}],"description_mirror"');
    expect(parseLumaEventPage(`${ld({ "@type": "Event", name: "x", startDate: "2026-11-01T10:00:00Z" })}${html}`)?.interestHints).toEqual([
      { label: "Tech", weight: 3 },
      { label: "AI", weight: 3 },
    ]);
  });

  it("falls back to the JSON-LD description without page data", () => {
    expect(lumaMirrorDescription("<html></html>")).toBeNull();
    expect(lumaMirrorDescription(withDoc({ type: "not-a-doc" }))).toBeNull();
    expect(parseLumaEventPage(page)?.description).toBeTruthy();
  });
});
