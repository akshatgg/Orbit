/** Pure user-agent / platform detection for the install experience. */

export type InstallPlatform =
  | "ios-safari"
  | "ios-chrome"
  | "ios-edge"
  | "ios-firefox"
  | "android-chromium"
  | "desktop-chromium"
  | "macos-safari"
  | "unsupported";

export type PlatformInfo = {
  platform: InstallPlatform;
  /** iPad (including iPadOS in desktop-site mode): the Share button is in the top toolbar. */
  isIPad: boolean;
};

export type DetectEnv = {
  /** navigator.maxTouchPoints: tells iPadOS (which reports a Mac UA) from a real Mac. */
  maxTouchPoints?: number;
};

const MIN_MAC_SAFARI = 17;

export function detectPlatform(ua: string, env: DetectEnv = {}): PlatformInfo {
  const touch = (env.maxTouchPoints ?? 0) > 1;
  const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  const isIOS = /iPhone|iPod/.test(ua) || isIPadUA;

  if (isIOS) {
    return { platform: detectIOS(ua), isIPad: isIPadUA };
  }
  return { platform: detectOther(ua), isIPad: false };
}

function detectIOS(ua: string): InstallPlatform {
  if (/CriOS/.test(ua)) return "ios-chrome";
  if (/EdgiOS/.test(ua)) return "ios-edge";
  if (/FxiOS/.test(ua)) return "ios-firefox";
  // Opera, DuckDuckGo, Google app, Instagram/Facebook webviews and friends cannot add to Home Screen.
  if (/OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger/.test(ua)) return "unsupported";
  // Real Safari carries both Version/ and Safari/; bare webviews carry neither.
  if (/Version\/[\d.]+/.test(ua) && /Safari\//.test(ua)) return "ios-safari";
  return "unsupported";
}

function detectOther(ua: string): InstallPlatform {
  if (/Android/.test(ua)) {
    if (/; wv\)|FBAN|FBAV|Instagram/.test(ua)) return "unsupported";
    if (/Firefox\//.test(ua)) return "unsupported";
    if (/Chrome\/|SamsungBrowser\/|EdgA\/|OPR\//.test(ua)) return "android-chromium";
    return "unsupported";
  }
  if (/Firefox\//.test(ua)) return "unsupported";
  if (/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return "desktop-chromium";
  if (/Macintosh/.test(ua) && /Version\/([\d.]+)/.test(ua) && /Safari\//.test(ua)) {
    const major = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return major >= MIN_MAC_SAFARI ? "macos-safari" : "unsupported";
  }
  return "unsupported";
}

export function isIOSPlatform(p: InstallPlatform): boolean {
  return p.startsWith("ios-");
}

/** Where the browser's Share button lives, so the guide can point at it. */
export function sharePosition(info: PlatformInfo): "bottom" | "top-right" {
  if (info.platform === "ios-safari" && !info.isIPad) return "bottom";
  return "top-right";
}
