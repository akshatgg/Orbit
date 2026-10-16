import { describe, expect, it } from "vitest";
import { detectPlatform, sharePosition } from "./detect";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  iphoneEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.87 Mobile/15E148 Safari/605.1.15",
  iphoneFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0",
  iphoneWebview: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  ipadSafari: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidEdge: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.2592.80",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  androidWebview: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  macSafari17: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari16: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("detectPlatform", () => {
  it.each([
    ["iPhone Safari", UA.iphoneSafari, "ios-safari"],
    ["iPhone Chrome", UA.iphoneChrome, "ios-chrome"],
    ["iPhone Edge", UA.iphoneEdge, "ios-edge"],
    ["iPhone Firefox", UA.iphoneFirefox, "ios-firefox"],
    ["iPhone Instagram webview", UA.iphoneInstagram, "unsupported"],
    ["iPhone bare webview", UA.iphoneWebview, "unsupported"],
    ["iPad Safari", UA.ipadSafari, "ios-safari"],
    ["Android Chrome", UA.androidChrome, "android-chromium"],
    ["Samsung Internet", UA.androidSamsung, "android-chromium"],
    ["Android Edge", UA.androidEdge, "android-chromium"],
    ["Android Firefox", UA.androidFirefox, "unsupported"],
    ["Android webview", UA.androidWebview, "unsupported"],
    ["Windows Chrome", UA.winChrome, "desktop-chromium"],
    ["Windows Edge", UA.winEdge, "desktop-chromium"],
    ["macOS Chrome", UA.macChrome, "desktop-chromium"],
    ["macOS Safari 17", UA.macSafari17, "macos-safari"],
    ["macOS Safari 16", UA.macSafari16, "unsupported"],
    ["Windows Firefox", UA.winFirefox, "unsupported"],
    ["macOS Firefox", UA.macFirefox, "unsupported"],
  ])("%s", (_name, ua, expected) => {
    expect(detectPlatform(ua).platform).toBe(expected);
  });

  it("treats a touch-capable Mac UA as iPadOS in desktop-site mode", () => {
    const info = detectPlatform(UA.ipadDesktopMode, { maxTouchPoints: 5 });
    expect(info).toEqual({ platform: "ios-safari", isIPad: true });
  });

  it("keeps a real Mac (no touch) as macOS Safari", () => {
    expect(detectPlatform(UA.macSafari17, { maxTouchPoints: 0 })).toEqual({ platform: "macos-safari", isIPad: false });
  });

  it("flags iPad UAs", () => {
    expect(detectPlatform(UA.ipadSafari).isIPad).toBe(true);
    expect(detectPlatform(UA.iphoneSafari).isIPad).toBe(false);
  });

  it("handles empty UA", () => {
    expect(detectPlatform("").platform).toBe("unsupported");
  });
});

describe("sharePosition", () => {
  it("points at the bottom toolbar on iPhone Safari", () => {
    expect(sharePosition(detectPlatform(UA.iphoneSafari))).toBe("bottom");
  });
  it("points top-right on iPad Safari and iOS Chrome/Edge", () => {
    expect(sharePosition(detectPlatform(UA.ipadSafari))).toBe("top-right");
    expect(sharePosition(detectPlatform(UA.iphoneChrome))).toBe("top-right");
    expect(sharePosition(detectPlatform(UA.iphoneEdge))).toBe("top-right");
  });
});
