import { describe, expect, it } from "vitest";
import { clamp, cleanProse, decodeEntities, oneLine, safeHttpUrl, stripHtml, summarise } from "./text";
import { zonedTimeToUtc } from "./timezone";
import { checkFeedUrl, checkResolvedAddresses, isPrivateAddress } from "./url-guard";

describe("text normaliser", () => {
  it("strips tags, scripts and comments but keeps paragraphs", () => {
    expect(stripHtml("<div>Hello<br/>world</div><script>alert(1)</script><!-- x --><ul><li>One</li><li>Two</li></ul>"))
      .toBe("Hello\nworld\n• One\n• Two");
  });

  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Fish &amp; chips &#163;5 &#x2014; &nbsp;ok &bogus;")).toBe("Fish & chips £5 —  ok &bogus;");
  });

  it("collapses whitespace for single-line fields", () => {
    expect(oneLine("  Case\n  Interview\t Bootcamp ")).toBe("Case Interview Bootcamp");
  });

  it("clamps on a word boundary", () => {
    expect(clamp("short", 10)).toBe("short");
    expect(clamp("the quick brown fox jumps", 15)).toBe("the quick…");
  });

  it("summarises from the first paragraph", () => {
    expect(summarise("First line.\nSecond line.")).toBe("First line.");
    expect(summarise(null)).toBeNull();
    expect(summarise("x".repeat(300))!.length).toBe(200);
  });

  it("only keeps http(s) links", () => {
    expect(safeHttpUrl("https://example.com/a b")).toBe("https://example.com/a%20b");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});

describe("cleanProse", () => {
  it("removes Markdown emphasis, links, bullets and separator lines", () => {
    const input = [
      "**The Hottest New Programming Language**",
      "",
      "Key Takeaways:",
      "",
      "* This talk is a continuation in [September 2025](https://example.com/e).",
      "",
      "-\\-\\-\\-\\-\\-",
      "**Food and Drinks**",
      "Pizza sponsored by [Codurance](https://www.codurance.com/), with vegan options.",
    ].join("\n");
    expect(cleanProse(input)).toBe([
      "The Hottest New Programming Language",
      "",
      "Key Takeaways:",
      "",
      "• This talk is a continuation in September 2025 (https://example.com/e).",
      "",
      "Food and Drinks",
      "Pizza sponsored by Codurance (https://www.codurance.com/), with vegan options.",
    ].join("\n"));
  });

  it("leaves ordinary prose and arithmetic alone", () => {
    expect(cleanProse("We meet at 2 * 3 rooms, C++ and snake_case stay.")).toBe("We meet at 2 * 3 rooms, C++ and snake_case stay.");
  });

  it("unescapes iCal punctuation and collapses long blank runs", () => {
    expect(cleanProse("Hello\\, world\\!\n\n\n\nNext")).toBe("Hello, world!\n\nNext");
  });
});

describe("zonedTimeToUtc", () => {
  it("handles BST, GMT and the DST gap", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 9 }, "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 9 }, "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    // 01:30 doesn't exist on 29 Mar 2026 in London → 02:30 BST.
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, "Europe/London").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 20, hour: 18 }, "Asia/Kolkata").toISOString()).toBe("2026-10-20T12:30:00.000Z");
  });
});

describe("feed URL guard", () => {
  const prod = { allowLoopback: false };
  it("accepts public http(s) URLs and converts webcal://", () => {
    expect(checkFeedUrl("https://calendar.example.com/feed.ics", prod).ok).toBe(true);
    const webcal = checkFeedUrl("webcal://calendar.example.com/feed.ics", prod);
    expect(webcal.ok && webcal.url.toString()).toBe("https://calendar.example.com/feed.ics");
  });

  it("blocks other schemes, credentials and private hosts", () => {
    for (const url of [
      "ftp://example.com/feed.ics", "file:///etc/passwd", "https://user:pw@example.com/f.ics",
      "http://localhost:8909/f.ics", "http://127.0.0.1/f.ics", "http://10.1.2.3/f.ics", "http://172.20.0.1/f.ics",
      "http://192.168.1.10/f.ics", "http://169.254.169.254/latest/meta-data", "http://[::1]/f.ics",
      "http://intranet/f.ics", "http://printer.local/f.ics",
    ]) {
      expect(checkFeedUrl(url, prod).ok, url).toBe(false);
    }
  });

  it("allows loopback only when told to (development)", () => {
    expect(checkFeedUrl("http://localhost:8909/f.ics", { allowLoopback: true }).ok).toBe(true);
    expect(checkFeedUrl("http://127.0.0.1:8909/f.ics", { allowLoopback: true }).ok).toBe(true);
    expect(checkFeedUrl("http://192.168.1.10/f.ics", { allowLoopback: true }).ok).toBe(false);
  });

  it("checks resolved addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(checkResolvedAddresses(["93.184.216.34"], prod)).toBeNull();
    expect(checkResolvedAddresses(["93.184.216.34", "10.0.0.5"], prod)).toMatch(/private/);
    expect(checkResolvedAddresses(["127.0.0.1"], { allowLoopback: true })).toBeNull();
  });
});
